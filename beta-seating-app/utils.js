function pushHistory() {
    if (state.currentClass) {
        const lastSnapshot = state.history[state.historyIndex];
        const currentSnapshot = {
            tables: JSON.parse(JSON.stringify(state.tables)),
            textObjects: JSON.parse(JSON.stringify(state.textObjects)),
            constraints: JSON.parse(JSON.stringify(state.constraints))
        };
        
        if (!lastSnapshot || JSON.stringify(lastSnapshot) !== JSON.stringify(currentSnapshot)) {
            state.history = state.history.slice(0, state.historyIndex + 1);
            state.history.push(currentSnapshot);
            state.historyIndex = state.history.length - 1;
        }
    }
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        const snapshot = state.history[state.historyIndex];
        state.tables = JSON.parse(JSON.stringify(snapshot.tables));
        state.textObjects = JSON.parse(JSON.stringify(snapshot.textObjects));
        state.constraints = JSON.parse(JSON.stringify(snapshot.constraints));
        state.lastAction = 'Undo';
        saveState();
        redrawCanvas();
        renderSeatingPlan();
        setTimeout(() => { state.lastAction = null; redrawCanvas(); }, 1500);
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const snapshot = state.history[state.historyIndex];
        state.tables = JSON.parse(JSON.stringify(snapshot.tables));
        state.textObjects = JSON.parse(JSON.stringify(snapshot.textObjects));
        state.constraints = JSON.parse(JSON.stringify(snapshot.constraints));
        state.lastAction = 'Redo';
        saveState();
        redrawCanvas();
        renderSeatingPlan();
        setTimeout(() => { state.lastAction = null; redrawCanvas(); }, 1500);
    }
}

function saveState() {
    if (state.currentClass) {
        state.currentClass.tables = state.tables;
        state.currentClass.textObjects = state.textObjects;
        state.currentClass.constraints = state.constraints;
        setLocalStorage('seatingAppClasses', state.classes);
    }
}

function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

function getLocalStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
        return defaultValue;
    }
}

function saveSeatingPlan() {
    if (!state.currentClass) return;
    const key = `seatingPlan_${state.currentClass.id}`;
    const seatingData = state.tables.map(table => ({
        ...table,
        students: table.students || []
    }));
    setLocalStorage(key, seatingData);
}

function loadSeatingPlan() {
    if (!state.currentClass) return;
    const key = `seatingPlan_${state.currentClass.id}`;
    const saved = getLocalStorage(key);
    if (saved) {
        state.tables = saved;
        renderSeatingPlan();
        redrawCanvas();
    }
}

function toggleSection(header) {
    const content = header.nextElementSibling;
    const toggle = header.querySelector('.section-toggle');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '−';
    } else {
        content.style.display = 'none';
        toggle.textContent = '+';
    }
}