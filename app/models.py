from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from .database import Base

class Router(Base):
    __tablename__ = "routers"

    id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, index=True)
    router_name = Column(String, unique=True, index=True)
    address = Column(String)
    
class LinkStatus(Base):
    __tablename__ = "link_status"

    id = Column(Integer, primary_key=True, index=True)
    router_name = Column(String, index=True)
    link_name = Column(String, index=True)
    status = Column(String)  # 'UP' or 'DOWN'
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
