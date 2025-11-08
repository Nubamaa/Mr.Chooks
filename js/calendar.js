class CalendarModal {
    constructor() {
        this.onSelect = null;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        const today = new Date().toISOString().slice(0, 10);
        const modalHtml = `
            <div id="calendar-modal" class="modal">
                <div class="modal-content">
                    <span class="close-button">&times;</span>
                    <h2>Select Date</h2>
                    <div id="calendar-container">
                        <input id="calendar-date-input" type="date" value="${today}" style="width:100%;padding:10px;" />
                        <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
                            <button id="calendar-today-btn" class="btn btn-secondary">Today</button>
                            <button id="calendar-apply-btn" class="btn btn-primary">Apply</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    setupEventListeners() {
        const modal = document.getElementById('calendar-modal');
        const closeButton = modal.querySelector('.close-button');
        const applyBtn = document.getElementById('calendar-apply-btn');
        const todayBtn = document.getElementById('calendar-today-btn');
        const dateInput = document.getElementById('calendar-date-input');

        closeButton.addEventListener('click', () => this.close());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });
        applyBtn.addEventListener('click', () => {
            const val = dateInput.value;
            if (this.onSelect && val) this.onSelect(val);
            this.close();
        });
        todayBtn.addEventListener('click', () => {
            const today = new Date().toISOString().slice(0, 10);
            dateInput.value = today;
        });
    }

    open(onSelect, initialDate) {
        this.onSelect = onSelect;
        const dateInput = document.getElementById('calendar-date-input');
        if (initialDate) dateInput.value = initialDate;
        document.getElementById('calendar-modal').style.display = 'block';
    }

    close() {
        document.getElementById('calendar-modal').style.display = 'none';
    }
}