document.addEventListener('DOMContentLoaded', () => {
    // Tenta conectar no mesmo host que serviu a página
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let ws;

    function connect() {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Conectado ao WebSocket do servidor');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            updateDashboard(data);
        };

        ws.onclose = () => {
            console.log('Conexão WebSocket perdida. Tentando reconectar em 5s...');
            setTimeout(connect, 5000);
        };
        
        ws.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            ws.close();
        };
    }

    function updateDashboard(data) {
        const { router_name, link_name, status, client_name } = data;
        
        // Identificadores únicos baseados no roteador e link
        const cardId = `card-${router_name}-${link_name}`;
        const statusId = `status-${router_name}-${link_name}`;
        
        let card = document.getElementById(cardId);
        let statusDiv = document.getElementById(statusId);

        // Se o card não existe, cria um novo dinamicamente
        if (!card) {
            createCard(router_name, link_name, status, client_name, cardId, statusId);
            card = document.getElementById(cardId);
            statusDiv = document.getElementById(statusId);
        }

        // Verifica qual era o status antigo para saber se houve mudança real
        const isCurrentlyUp = statusDiv.classList.contains('up');
        const isNewUp = (status === 'UP');

        if (isCurrentlyUp !== isNewUp) {
            // Houve mudança real de estado!
            
            // Atualiza as classes da bolinha
            if (isNewUp) {
                statusDiv.classList.remove('down');
                statusDiv.classList.add('up');
            } else {
                statusDiv.classList.remove('up');
                statusDiv.classList.add('down');
            }

            // Dispara a animação de vibração no card
            card.classList.remove('shake'); // reseta caso já estivesse
            void card.offsetWidth; // trigger reflow para a animação reiniciar
            card.classList.add('shake');
            
            // Remove a classe shake depois que a animação terminar (0.82s)
            setTimeout(() => {
                card.classList.remove('shake');
            }, 1000);
        }
    }

    function createCard(router_name, link_name, status, client_name, cardId, statusId) {
        const grid = document.getElementById('dashboard-grid');
        const statusClass = status === 'UP' ? 'up' : 'down';
        
        const cardHTML = `
            <div class="card shake" id="${cardId}">
                <div class="card-header">
                    <span class="client-name">${client_name}</span>
                    <span class="router-name">${router_name}</span>
                </div>
                
                <div class="card-body">
                    <div class="status-indicator ${statusClass}" id="${statusId}"></div>
                </div>
                
                <div class="card-footer">
                    <span class="link-name">${link_name}</span>
                </div>
            </div>
        `;
        
        grid.insertAdjacentHTML('beforeend', cardHTML);
        
        // Remove the initial shake after 1s
        setTimeout(() => {
            const newCard = document.getElementById(cardId);
            if(newCard) newCard.classList.remove('shake');
        }, 1000);
    }

    // Inicia a conexão
    connect();
});
