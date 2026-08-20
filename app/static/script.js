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
        
        const cardId = `card-${router_name}`;
        const bodyId = `body-${router_name}`;
        const linkContainerId = `link-container-${router_name}-${link_name}`;
        const statusId = `status-${router_name}-${link_name}`;
        
        let card = document.getElementById(cardId);

        // Se o card do router não existe, cria
        if (!card) {
            createRouterCard(router_name, client_name, cardId, bodyId);
            card = document.getElementById(cardId);
        }

        let statusDiv = document.getElementById(statusId);

        // Se a bolinha do link não existe, cria dentro do body do card
        if (!statusDiv) {
            createLinkItem(bodyId, router_name, link_name, status, linkContainerId, statusId);
            statusDiv = document.getElementById(statusId);
        }

        const isCurrentlyUp = statusDiv.classList.contains('up');
        const isNewUp = (status === 'UP');

        if (isCurrentlyUp !== isNewUp) {
            // Atualiza as classes
            if (isNewUp) {
                statusDiv.classList.remove('down');
                statusDiv.classList.add('up');
            } else {
                statusDiv.classList.remove('up');
                statusDiv.classList.add('down');
            }

            // Animação de vibração no card inteiro do router
            card.classList.remove('shake');
            void card.offsetWidth; 
            card.classList.add('shake');
            
            setTimeout(() => {
                card.classList.remove('shake');
            }, 1000);
        }
    }

    function createRouterCard(router_name, client_name, cardId, bodyId) {
        const grid = document.getElementById('dashboard-grid');
        
        const cardHTML = `
            <div class="card shake" id="${cardId}">
                <div class="card-header">
                    <span class="client-name">${client_name}</span>
                    <span class="router-name">${router_name}</span>
                </div>
                <div class="card-body" id="${bodyId}"></div>
            </div>
        `;
        
        grid.insertAdjacentHTML('beforeend', cardHTML);
        
        setTimeout(() => {
            const newCard = document.getElementById(cardId);
            if(newCard) newCard.classList.remove('shake');
        }, 1000);
    }

    function createLinkItem(bodyId, router_name, link_name, status, linkContainerId, statusId) {
        const body = document.getElementById(bodyId);
        const statusClass = status === 'UP' ? 'up' : 'down';
        
        const linkHTML = `
            <div class="link-item" id="${linkContainerId}">
                <div class="status-indicator ${statusClass}" id="${statusId}"></div>
                <span class="link-name-small">${link_name}</span>
            </div>
        `;
        body.insertAdjacentHTML('beforeend', linkHTML);
    }

    // Inicia a conexão
    connect();
});
