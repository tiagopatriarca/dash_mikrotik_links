import asyncio
import os
from fastapi import FastAPI, Request, Depends, HTTPException, WebSocket, WebSocketDisconnect, Header
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from . import models, database

# Criação das tabelas no banco de dados
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="MikroTik NOC Dashboard")

# Configuração de templates e arquivos estáticos
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Token de segurança (pode ser configurado via variável de ambiente)
SECRET_TOKEN = os.getenv("SECRET_TOKEN", "SEU_TOKEN_SECRETO_123")

# Connection Manager para WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

# Pydantic schema for webhook payload
class WebhookPayload(BaseModel):
    router_name: str
    link_name: str
    status: str

@app.get("/", response_class=HTMLResponse)
async def get_dashboard(request: Request, db: Session = Depends(database.get_db)):
    # Buscar o status atual de todos os links para popular a tela inicial
    # Aqui, agrupamos para mostrar o estado mais recente de cada link
    links = db.query(models.LinkStatus).all()
    # Pega também a lista de roteadores cadastrados
    routers = db.query(models.Router).all()
    
    # Criar um dict para acesso rápido aos nomes dos clientes
    client_map = {r.router_name: r.client_name for r in routers}
    
    # Organizar os links por roteador
    routers_data = {}
    for link in links:
        r_name = link.router_name
        if r_name not in routers_data:
            routers_data[r_name] = {
                "router_name": r_name,
                "client_name": client_map.get(r_name, "Desconhecido"),
                "links": []
            }
        routers_data[r_name]["links"].append({
            "link_name": link.link_name,
            "status": link.status
        })
        
    return templates.TemplateResponse("index.html", {"request": request, "routers": routers_data.values()})

@app.post("/api/webhook")
async def receive_webhook(
    payload: WebhookPayload, 
    db: Session = Depends(database.get_db),
    authorization: str = Header(None)
):
    # Verificação de segurança simples (Token Bearer)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split(" ")[1]
    if token != SECRET_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden: Invalid Token")
        
    # Força o status para maiúsculo para evitar erros de digitação (up -> UP)
    safe_status = payload.status.upper()
        
    # Verificar se o roteador está cadastrado
    router = db.query(models.Router).filter(models.Router.router_name == payload.router_name).first()
    if not router:
        raise HTTPException(status_code=404, detail="Router not found in registry")

    # Salvar ou atualizar o status do link no banco
    link_status = db.query(models.LinkStatus).filter(
        models.LinkStatus.router_name == payload.router_name,
        models.LinkStatus.link_name == payload.link_name
    ).first()

    if link_status:
        link_status.status = safe_status
    else:
        link_status = models.LinkStatus(
            router_name=payload.router_name,
            link_name=payload.link_name,
            status=safe_status
        )
        db.add(link_status)
        
    db.commit()

    # Enviar notificação via WebSocket para a Dashboard
    update_data = {
        "router_name": payload.router_name,
        "link_name": payload.link_name,
        "status": safe_status,
        "client_name": router.client_name
    }
    await manager.broadcast(json.dumps(update_data))

    return {"message": "Status updated successfully"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Mantém a conexão aberta e escutando (apesar de só recebermos pings/keep-alive do client se necessário)
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Endpoints simples para gerenciar cadastro de Roteadores
class RouterCreate(BaseModel):
    client_name: str
    router_name: str
    address: str

@app.post("/api/routers")
async def create_router(router: RouterCreate, db: Session = Depends(database.get_db)):
    db_router = models.Router(
        client_name=router.client_name,
        router_name=router.router_name,
        address=router.address
    )
    db.add(db_router)
    db.commit()
    db.refresh(db_router)
    return db_router
