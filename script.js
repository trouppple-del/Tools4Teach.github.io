
const state = {
    classes: [],
    currentClass: null,
    students: [],
    constraints: [],
    tables: [], 
    textObjects: [],
    currentTool: 'square',
    constraintType: 'separate',
    peoplePerTable: 4,
    allowMultiple: false,
    isDrawing: false,
    isTyping: false,
    startX: 0,
    startY: 0,
    currentMouseX: 0,
    currentMouseY: 0,
    pan: { x: 0, y: 0 },
    scale: 1,
    selectedTableIndex: -1,
    draggingTableIndex: -1,
    selectedTextIndex: -1,
    draggingTextIndex: -1,
    previewMode: false,
    clipboardTable: null,
    spacePressed: false,
    currentColor: '#3b82f6',
    rotationStart: null,
    scaleStart: null,
    selectedStudentInSeating: null,
    draggingStudentFrom: null,
    lastAction: null,
    history: [],
    historyIndex: -1
};

// Undo/Redo system
function pushHistory() {
    if (state.currentClass) {
        // Only push if state has actually changed
        const lastSnapshot = state.history[state.historyIndex];
        const currentSnapshot = {
            tables: JSON.parse(JSON.stringify(state.tables)),
            textObjects: JSON.parse(JSON.stringify(state.textObjects)),
            constraints: JSON.parse(JSON.stringify(state.constraints))
        };
        
        // Only add if different from last snapshot
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

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let resizeTimer;


function resizeCanvas() {
    canvas.width = window.innerWidth - 320;
    canvas.height = window.innerHeight;
    redrawCanvas();
}

function getLocalStorage(key, defaultValue = null) {
    try {const value = localStorage.getItem(key); return value ? JSON.parse(value) :
        defaultValue;} catch {return defaultValue;}
}

function setLocalStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value));} catch (e) {
         console.error('localStorage error:', e);}
}

function saveState() {
    if (state.currentClass) {
        state.currentClass.tables = state.tables;
        state.currentClass.constraints = state.constraints;
        state.currentClass.textObjects = state.textObjects;
    }
    setLocalStorage('seatingAppClasses', state.classes);
}

function saveSeatingPlan() {
    if (state.currentClass) {
        const seatingData = {
            classId: state.currentClass.id,
            tables: state.tables,
            timestamp: Date.now()
        };
        setLocalStorage(`seatingPlan_${state.currentClass.id}`, seatingData);
    }
}

function loadSeatingPlan() {
    if (state.currentClass) {
        const key = `seatingPlan_${state.currentClass.id}`;
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            if (saved && saved.tables) {
                state.tables = saved.tables;
                return true;
            }
        } catch {
            return false;
        }
    }
    return false;
}

function loadState() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem('seatingAppClasses'));
    } catch {
        saved = [];
    }
    state.classes = saved || [];
    renderClassList();
}

function createClass(name) {
    const newClass = {
        id: Date.now(),
        name: name || `Class ${state.classes.length + 1}`,
        students: [],
        tables: [],
        textObjects: [],
        constraints: []
    };
    state.classes.push(newClass);
    saveState();
    renderClassList();
    return newClass;
}

function selectClass(classId) {
    state.currentClass = state.classes.find(c => c.id === classId);
    state.students = state.currentClass ? [...state.currentClass.students] : [];
    state.tables = state.currentClass ? [...state.currentClass.tables] : [];
    state.textObjects = state.currentClass && state.currentClass.textObjects ? [...state.currentClass.textObjects] : [];
    state.constraints = state.currentClass && state.currentClass.constraints ? [...state.currentClass.constraints] : [];
    
    // Load saved seating plan for this class
    loadSeatingPlan();
    
    updateUI();
    renderClassList();
    renderStudentList();
    renderConstraintsList();
    renderSeatingPlan();
    redrawCanvas();
}

function deleteClass(classId) {
    state.classes = state.classes.filter(c => c.id !== classId);
    if (state.currentClass?.id === classId) {
        state.currentClass = null;
        state.students = [];
    }
    saveState();
    renderClassList();
    updateUI();
}

function duplicateClass(classId) {
    const original = state.classes.find(c => c.id === classId);
    if (!original) return;
    
    const newClass = {
        id: Date.now(),
        name: `${original.name} (Copy)`,
        students: [],
        tables: original.tables.map(t => ({ ...t })),
        textObjects: original.textObjects.map(t => ({ ...t })),
        constraints: original.constraints.map(c => ({ ...c }))
    };
    
    state.classes.push(newClass);
    saveState();
    renderClassList();
}

function renameClass(classId, newName) {
    if (!newName.trim()) return;
    const cls = state.classes.find(c => c.id === classId);
    if (cls) {
        cls.name = newName.trim();
        if (state.currentClass?.id === classId) {
            state.currentClass.name = newName.trim();
        }
        saveState();
        renderClassList();
    }
}

function renderClassList() {
    const classList = document.getElementById('classList');
    classList.innerHTML = state.classes.map(cls => `
        <div class="class-item ${state.currentClass?.id === cls.id ? 'active' : ''}" 
             onclick="selectClass(${cls.id})"
             ondblclick="event.stopPropagation(); editClassName(${cls.id})"
             oncontextmenu="event.preventDefault(); showClassContextMenu(event, ${cls.id})">
            <span class="class-name-${cls.id}">${cls.name} (${cls.students.length})</span>
            <div class="class-item-actions">
                <button onclick="event.stopPropagation(); deleteClass(${cls.id})">✕</button>
            </div>
        </div>
    `).join('');
}

function editClassName(classId) {
    const cls = state.classes.find(c => c.id === classId);
    if (!cls) return;
    
    const newName = prompt('Enter new class name:', cls.name);
    if (newName !== null) {
        renameClass(classId, newName);
    }
}

function showClassContextMenu(event, classId) {
    const menu = document.createElement('div');
    menu.style.cssText = `
        position: fixed;
        top: ${event.clientY}px;
        left: ${event.clientX}px;
        background-color: var(--surface);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 0;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        min-width: 150px;
    `;
    
    menu.innerHTML = `
        <div style="padding: 8px; cursor: pointer; color: var(--text); font-size: 13px; 
                    border-bottom: 1px solid var(--border); padding: 10px;"
             onclick="duplicateClass(${classId}); this.parentElement.remove();">
            📋 Duplicate Class Layout
        </div>
        <div style="padding: 8px; cursor: pointer; color: var(--text); font-size: 13px; 
                    padding: 10px;"
             onclick="editClassName(${classId}); this.parentElement.remove();">
            ✏️ Rename Class
        </div>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', function removeMenu() {
            if (menu.parentElement) {
                menu.remove();
            }
            document.removeEventListener('click', removeMenu);
        }, 0);
    }, 0);
}
let globalStudentId = Math.floor(Math.random() * 1000000000) + Date.now();

function addStudent(name) {
    if (!state.currentClass || !name.trim()) return;
    
    const newStudent = {
        id: ++globalStudentId,
        name: name.trim()
    };
    
    state.currentClass.students.push(newStudent);
    state.students.push(newStudent);
    
    saveState();
    renderStudentList();
    renderClassList();
}

function removeStudent(studentId) {
    if (!state.currentClass) return;
    
    state.currentClass.students = state.currentClass.students.filter(s => s.id !== studentId);
    state.students = state.students.filter(s => s.id !== studentId);
    state.constraints = state.constraints.filter(c => c.student1 !== studentId && c.student2 !== studentId);
    
    saveState();
    renderStudentList();
    renderConstraintsList();
}

function renderStudentList() {
    const studentList = document.getElementById('studentList');
    const noClassSelected = document.getElementById('noClassSelected');
    const studentManager = document.getElementById('studentManager');
    
    if (!state.currentClass) {
        studentManager.style.display = 'none';
        noClassSelected.style.display = 'block';
        return;
    }
    
    studentManager.style.display = 'flex';
    noClassSelected.style.display = 'none';
    
    studentList.innerHTML = state.students.map(student => `
        <div class="student-item">
            <span>${student.name}</span>
            <button onclick="removeStudent(${student.id})">✕</button>
        </div>
    `).join('');
}

function addConstraint(student1, student2) {
    const existing = state.constraints.find(c => 
        (c.student1 === student1 && c.student2 === student2) ||
        (c.student1 === student2 && c.student2 === student1)
    );
    
    if (!existing) {
        const constraint = { student1, student2, type: state.constraintType };
        state.constraints.push(constraint);
        if (state.currentClass) {
            state.currentClass.constraints.push(constraint);
        }
        saveState();
        renderConstraintsList();
    }
}

function removeConstraint(index) {
    state.constraints.splice(index, 1);
    if (state.currentClass) {
        state.currentClass.constraints = state.currentClass.constraints.filter((_, i) => i !== index);
    }
    saveState();
    renderConstraintsList();
}

function renderConstraintsList() {
    const constraintsList = document.getElementById('constraintsList');
    
    if (state.constraints.length === 0) {
        constraintsList.innerHTML = '<div class="add-constraint" onclick="showConstraintModal()">+ Add Constraint</div>';
        return;
    }
    
    const html = state.constraints.map((constraint, idx) => {
        const s1 = state.students.find(s => s.id === constraint.student1);
        const s2 = state.students.find(s => s.id === constraint.student2);
        const icon = constraint.type === 'separate' ? '≠' : '✓';
        return `
            <div class="constraint-item">
                <span>${s1?.name || '?'} ${icon} ${s2?.name || '?'}</span>
                <button onclick="removeConstraint(${idx})">✕</button>
            </div>
        `;
    }).join('');
    
    constraintsList.innerHTML = html + '<div class="add-constraint" onclick="showConstraintModal()">+ Add</div>';
}

function showConstraintModal() {
    if (state.students.length < 2) {
        alert('Need at least 2 students to create constraints');
        return;
    }
    
    let selectedIdx1 = 0;
    let selectedIdx2 = 1;
    
    const typeLabel = state.constraintType === 'separate' ? 'Separate' : 'Keep Together';
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 8px; padding: 20px; z-index: 1000;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5); min-width: 300px;
    `;
    
    let selectHtml = '<select style="padding: 8px; background-color: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; color: var(--text); width: 100%;"><option value="0">-- Select --</option>';
    state.students.forEach((s, idx) => {
        selectHtml += `<option value="${idx}">${s.name}</option>`;
    });
    selectHtml += '</select>';
    
    modal.innerHTML = `
        <h3 style="color: var(--text); margin-bottom: 15px;">Add ${typeLabel} Constraint</h3>
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-direction: column;">
            <label style="color: var(--text-muted); font-size: 12px;">Student 1</label>
            <div id="sel1">${selectHtml}</div>
            <label style="color: var(--text-muted); font-size: 12px; margin-top: 10px;">Student 2</label>
            <div id="sel2">${selectHtml}</div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="cancelBtn" style="flex: 1; background-color: var(--secondary); border: none; padding: 8px; border-radius: 6px; color: var(--text); cursor: pointer;">Cancel</button>
            <button id="addBtn" style="flex: 1; background-color: var(--success); border: none; padding: 8px; border-radius: 6px; color: white; cursor: pointer;">Add</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const select1 = modal.querySelector('#sel1 select');
    const select2 = modal.querySelector('#sel2 select');
    
    select1.value = '0';
    if (state.students.length > 1) {
        select2.value = '1';
    }
    
    select1.addEventListener('change', (e) => {
        selectedIdx1 = parseInt(e.target.value);
        console.log('Selected1:', selectedIdx1, state.students[selectedIdx1]?.name);
    });
    
    select2.addEventListener('change', (e) => {
        selectedIdx2 = parseInt(e.target.value);
        console.log('Selected2:', selectedIdx2, state.students[selectedIdx2]?.name);
    });
    
    modal.querySelector('#cancelBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#addBtn').addEventListener('click', () => {
        console.log('Add clicked. Idx1:', selectedIdx1, 'Idx2:', selectedIdx2);
        console.log('Student1:', state.students[selectedIdx1]);
        console.log('Student2:', state.students[selectedIdx2]);
        
        if (selectedIdx1 === selectedIdx2) {
            alert('Select two different students');
            return;
        }
        
        addConstraint(state.students[selectedIdx1].id, state.students[selectedIdx2].id);
        modal.remove();
    });
}

function drawGrid() {
    const gridSize = state.snapToGrid ? 20 : 50;
    const gridColor = state.snapToGrid ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.1)';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = state.snapToGrid ? 1.5 : 1;
    
    const startX = Math.floor((-state.pan.x) / gridSize) * gridSize;
    const startY = Math.floor((-state.pan.y) / gridSize) * gridSize;
    const endX = startX + canvas.width / state.scale + gridSize;
    const endY = startY + canvas.height / state.scale + gridSize;
    
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo((x + state.pan.x) * state.scale, (-state.pan.y) * state.scale);
        ctx.lineTo((x + state.pan.x) * state.scale, (endY + state.pan.y) * state.scale);
        ctx.stroke();
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo((startX + state.pan.x) * state.scale, (y + state.pan.y) * state.scale);
        ctx.lineTo((endX + state.pan.x) * state.scale, (y + state.pan.y) * state.scale);
        ctx.stroke();
    }
}

function drawTable(table, isSelected = false) {
    ctx.save();
    
    const baseColor = table.color || '#3b82f6';
    const baseColorLight = baseColor + '1a'; // Add transparency
    
    if (table.type === 'square') {
        ctx.fillStyle = isSelected ? baseColor + '4d' : baseColorLight;
        ctx.strokeStyle = isSelected ? baseColor : baseColor;
        ctx.lineWidth = isSelected ? 3 : 2;
        
        const x = (table.x + state.pan.x) * state.scale;
        const y = (table.y + state.pan.y) * state.scale;
        const w = (table.width || 50) * state.scale;
        const h = (table.height || 50) * state.scale;
        
        // Apply rotation if present
        if (table.rotation && table.rotation !== 0) {
            ctx.translate(x + w/2, y + h/2);
            ctx.rotate(table.rotation);
            ctx.fillRect(-w/2, -h/2, w, h);
            ctx.strokeRect(-w/2, -h/2, w, h);
            
            // Draw table number with rotation applied
            const tableNum = state.tables.indexOf(table) + 1;
            const darkerColor = table.color ? table.color.replace(/[\da-f]/gi, (c) => {
                const n = parseInt(c, 16);
                return Math.max(0, n - 3).toString(16);
            }) : '#000000';
            ctx.fillStyle = darkerColor + '40';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`T${tableNum}`, -w/2 + 5, -h/2 + 5);
            
            ctx.restore();
            ctx.save();
        } else {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            
            // Draw table number for non-rotated
            const tableNum = state.tables.indexOf(table) + 1;
            const darkerColor = table.color ? table.color.replace(/[\da-f]/gi, (c) => {
                const n = parseInt(c, 16);
                return Math.max(0, n - 3).toString(16);
            }) : '#000000';
            ctx.fillStyle = darkerColor + '40';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`T${tableNum}`, x + 5, y + 5);
        }
        
        if (table.students && table.students.length > 0) {
            ctx.fillStyle = '#1f2937';
            const fontSize = 12; // Fixed size regardless of rotation/zoom
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const startY = y + 10;
            const lineHeight = fontSize + 4;
            
            table.students.forEach((student, idx) => {
                const nameY = startY + (idx * lineHeight);
                if (nameY + lineHeight < y + h) {
                    ctx.fillText(student.name || 'Unknown', x + w / 2, nameY);
                }
            });
        } else {
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${table.students.length}/${table.capacity}`, x + w / 2, y + h / 2);
        }
    } else if (table.type === 'circle') {
        ctx.fillStyle = isSelected ? baseColor + '4d' : baseColorLight;
        ctx.strokeStyle = isSelected ? baseColor : baseColor;
        ctx.lineWidth = isSelected ? 3 : 2;
        
        const x = (table.x + state.pan.x) * state.scale;
        const y = (table.y + state.pan.y) * state.scale;
        const r = (table.radius || 30) * state.scale;
        
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw table number in top-left with darker shade of table color
        const tableNum = state.tables.indexOf(table) + 1;
        const darkerColor = table.color ? table.color.replace(/[\da-f]/gi, (c) => {
            const n = parseInt(c, 16);
            return Math.max(0, n - 3).toString(16);
        }) : '#000000';
        ctx.fillStyle = darkerColor + '40';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`T${tableNum}`, x - r + 5, y - r + 5);
        
        if (table.students && table.students.length > 0) {
            ctx.fillStyle = '#1f2937';
            const fontSize = 12; // Fixed size regardless of zoom
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const maxNames = Math.floor((r * 2) / (fontSize + 4));
            table.students.slice(0, maxNames).forEach((student, idx) => {
                const offset = (idx - (maxNames - 1) / 2) * (fontSize + 4);
                ctx.fillText(student.name || 'Unknown', x, y + offset);
            });
        } else {
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${table.students.length}/${table.capacity}`, x, y);
        }
    }
    
    ctx.restore();
}

function drawTextObject(textObj, isSelected = false) {
    ctx.save();
    
    const x = (textObj.x + state.pan.x) * state.scale;
    const y = (textObj.y + state.pan.y) * state.scale;
    const fontSize = textObj.fontSize || 14; // Fixed size independent of zoom
    
    ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.8)';
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#d1d5db';
    ctx.lineWidth = isSelected ? 2 : 1;
    
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const metrics = ctx.measureText(textObj.text);
    const width = metrics.width + 8;
    const height = fontSize + 8;
    
    // Apply rotation if present
    if (textObj.rotation && textObj.rotation !== 0) {
        ctx.translate(x + width/2, y + height/2);
        ctx.rotate(textObj.rotation);
        ctx.fillRect(-width/2 - 4, -height/2 - 4, width, height);
        ctx.strokeRect(-width/2 - 4, -height/2 - 4, width, height);
        
        ctx.fillStyle = textObj.color || '#000000';
        ctx.fillText(textObj.text, -width/2, -height/2);
    } else {
        ctx.fillRect(x - 4, y - 4, width, height);
        ctx.strokeRect(x - 4, y - 4, width, height);
        
        ctx.fillStyle = textObj.color || '#000000';
        ctx.fillText(textObj.text, x, y);
    }
    
    ctx.restore();
}

function drawPreview(x, y, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const actualWidth = Math.abs(w);
    const actualHeight = Math.abs(h);
    const startX = Math.min(x, x + w);
    const startY = Math.min(y, y + h);
    
    if (state.currentTool === 'square') {
        ctx.strokeRect(startX, startY, actualWidth, actualHeight);
        
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(startX + 5, startY - 20, 120, 18);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 1)';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${actualWidth.toFixed(0)} × ${actualHeight.toFixed(0)}`, startX + 7, startY - 5);
    } else if (state.currentTool === 'circle') {
        const radius = Math.sqrt(w * w + h * h) / 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(x + 5, y - 20, 120, 18);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 1)';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Ø${(radius * 2).toFixed(0)}`, x + 7, y - 5);
    }
    
    ctx.restore();
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawGrid();
    
    state.tables.forEach((table, idx) => {
        drawTable(table, idx === state.selectedTableIndex);
    });
    
    // Draw text on top for priority
    state.textObjects.forEach((textObj, idx) => {
        drawTextObject(textObj, idx === state.selectedTextIndex);
    });
    
    if (state.isDrawing) {
        const startScreenX = (state.startX + state.pan.x) * state.scale;
        const startScreenY = (state.startY + state.pan.y) * state.scale;
        
        const w = state.currentMouseX - startScreenX;
        const h = state.currentMouseY - startScreenY;
        
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        
        const minX = Math.min(startScreenX, startScreenX + w);
        const maxX = Math.max(startScreenX, startScreenX + w);
        const minY = Math.min(startScreenY, startScreenY + h);
        const maxY = Math.max(startScreenY, startScreenY + h);
        
        ctx.strokeRect(minX, minY, Math.abs(w), Math.abs(h));
        ctx.restore();
        
        drawPreview(startScreenX, startScreenY, w, h);
    }
    
    // Display action in corner
    if (state.lastAction) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, canvas.height - 40, 150, 35);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(state.lastAction, 15, canvas.height - 18);
    }
}

function moveTable(tableIndex, newX, newY) {
    if (tableIndex < 0 || tableIndex >= state.tables.length) return;
    
    // Apply grid snapping if enabled (only for squares)
    if (state.snapToGrid && state.tables[tableIndex].type === 'square') {
        const gridSize = 20;
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
    }
    
    state.tables[tableIndex].x = newX;
    state.tables[tableIndex].y = newY;
    redrawCanvas();
}

function deleteTable(tableIndex) {
    if (tableIndex < 0 || tableIndex >= state.tables.length) return;
    state.tables.splice(tableIndex, 1);
    if (state.selectedTableIndex === tableIndex) {
        state.selectedTableIndex = -1;
    }
    saveState();
    renderSeatingPlan();
    redrawCanvas();
}

function getTableAt(x, y) {
    for (let i = state.tables.length - 1; i >= 0; i--) {
        const table = state.tables[i];
        if (table.type === 'square') {
            if (x >= table.x && x <= table.x + table.width &&
                y >= table.y && y <= table.y + table.height) {
                return i;
            }
        } else if (table.type === 'circle') {
            const dx = x - table.x;
            const dy = y - table.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= table.radius) {
                return i;
            }
        }
    }
    return -1;
}

function moveTextObject(textIndex, newX, newY) {
    if (textIndex < 0 || textIndex >= state.textObjects.length) return;
    state.textObjects[textIndex].x = newX;
    state.textObjects[textIndex].y = newY;
    redrawCanvas();
}

function deleteTextObject(textIndex) {
    if (textIndex < 0 || textIndex >= state.textObjects.length) return;
    state.textObjects.splice(textIndex, 1);
    if (state.selectedTextIndex === textIndex) {
        state.selectedTextIndex = -1;
    }
    saveState();
    redrawCanvas();
}

function getTextAt(x, y) {
    for (let i = state.textObjects.length - 1; i >= 0; i--) {
        const textObj = state.textObjects[i];
        const fontSize = textObj.fontSize || 14; // Absolute font size, not scaled
        const objX = (textObj.x + state.pan.x) * state.scale;
        const objY = (textObj.y + state.pan.y) * state.scale;
        
        const metrics = ctx.measureText(textObj.text);
        const width = metrics.width + 8;
        const height = fontSize + 8;
        
        // Increased hitbox from 4px to 12px for better sensitivity
        if (x >= objX - 12 && x <= objX + width + 12 &&
            y >= objY - 12 && y <= objY + height + 12) {
            return i;
        }
    }
    return -1;
}

function canPlaceAtTable(student, table) {
    // Check separation constraints
    const hasSeparationViolation = state.constraints.some(c =>
        c.type === 'separate' &&
        (
            (c.student1 === student.id && table.students.some(ts => ts.id === c.student2)) ||
            (c.student2 === student.id && table.students.some(ts => ts.id === c.student1))
        )
    );
    
    if (hasSeparationViolation) return false;
    
    // Check together constraints - if student has a together constraint with someone,
    // that person must be at this table or not placed yet
    const togetherConstraints = state.constraints.filter(c =>
        c.type === 'together' &&
        (c.student1 === student.id || c.student2 === student.id)
    );
    
    for (const constraint of togetherConstraints) {
        const partnerId = constraint.student1 === student.id ? constraint.student2 : constraint.student1;
        const partnerAtTable = table.students.some(ts => ts.id === partnerId);
        
        // Check if partner is placed somewhere
        const partnerPlaced = state.tables.some(t => t.students.some(st => st.id === partnerId));
        
        // If partner is already placed but not at this table, can't place here
        if (partnerPlaced && !partnerAtTable) {
            return false;
        }
    }
    
    return true;
}

function generateSeatingPlan() {
    if (!state.currentClass || state.students.length === 0) {
        alert('Select a class with students first');
        return;
    }

    if (state.tables.length === 0) {
        alert('Create at least one table first');
        return;
    }

    // Clear non-locked students from all tables
    state.tables.forEach(t => {
        t.students = t.students.filter(s => s.locked);
    });

    // Build together groups
    const togetherGroups = [];
    for (const c of state.constraints) {
        if (c.type !== 'together') continue;
        let g = togetherGroups.find(x => x.includes(c.student1) || x.includes(c.student2));
        if (!g) {
            g = [];
            togetherGroups.push(g);
        }
        if (!g.includes(c.student1)) g.push(c.student1);
        if (!g.includes(c.student2)) g.push(c.student2);
    }

    const placed = new Set();

    // PHASE 1: Place complete together groups
    for (const group of togetherGroups) {
        const members = group
            .map(id => state.students.find(s => s.id === id))
            .filter(s => !placed.has(s.id)); // Only include unplaced members

        if (members.length === 0) continue;

        // Find a table that fits all group members
        let foundTable = false;
        for (const table of state.tables) {
            const space = table.capacity - table.students.length;
            if (space < members.length) continue;

            // Check if all members can be placed (no separation conflicts)
            let valid = true;
            for (const member of members) {
                if (!canPlaceAtTable(member, table)) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                // Place all members at this table
                for (const member of members) {
                    table.students.push({ ...member, locked: false });
                    placed.add(member.id);
                }
                foundTable = true;
                break;
            }
        }
    }

    // PHASE 2: Place remaining individual students
    const unplaced = state.students.filter(s => !placed.has(s.id));
    
    // Shuffle for randomness
    for (let i = unplaced.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unplaced[i], unplaced[j]] = [unplaced[j], unplaced[i]];
    }

    for (const student of unplaced) {
        // First, try to place with their together group members if any exist
        const group = togetherGroups.find(g => g.includes(student.id));
        let placed_here = false;

        if (group) {
            for (const memberId of group) {
                if (memberId === student.id) continue;
                
                // Find table with this group member
                for (const table of state.tables) {
                    if (table.students.some(s => s.id === memberId)) {
                        if (table.students.length < table.capacity && canPlaceAtTable(student, table)) {
                            table.students.push({ ...student, locked: false });
                            placed.add(student.id);
                            placed_here = true;
                            break;
                        }
                    }
                }
                if (placed_here) break;
            }
        }

        // If not placed with group, find any valid table
        if (!placed_here) {
            for (const table of state.tables) {
                if (table.students.length < table.capacity && canPlaceAtTable(student, table)) {
                    table.students.push({ ...student, locked: false });
                    placed.add(student.id);
                    break;
                }
            }
        }
    }

    // PHASE 3: Emergency placement - try to boot someone out if needed
    const stillUnplaced = state.students.filter(s => !placed.has(s.id));
    
    if (stillUnplaced.length > 0) {
        console.warn(`${stillUnplaced.length} students couldn't be placed with constraints. Attempting rescue placement...`);
        
        for (const student of stillUnplaced) {
            let placed_rescue = false;
            
            // First try to find a table with space that respects constraints
            for (const table of state.tables) {
                if (table.students.length < table.capacity && canPlaceAtTable(student, table)) {
                    table.students.push({ ...student, locked: false });
                    placed.add(student.id);
                    console.warn(`Rescued ${student.name} - placed in valid table with space`);
                    placed_rescue = true;
                    break;
                }
            }
            
            // If not placed, try to boot someone out
            if (!placed_rescue) {
                for (const table of state.tables) {
                    // Try to boot each student from this table
                    for (let i = 0; i < table.students.length; i++) {
                        const boostedStudent = table.students[i];
                        
                        // Don't boot locked students
                        if (boostedStudent.locked) continue;
                        
                        // Don't boot students who have a "together" constraint with someone already at this table
                        const hasTogetherAtTable = state.constraints.some(c =>
                            c.type === 'together' &&
                            ((c.student1 === boostedStudent.id && table.students.some((s, idx) => idx !== i && s.id === c.student2)) ||
                             (c.student2 === boostedStudent.id && table.students.some((s, idx) => idx !== i && s.id === c.student1)))
                        );
                        
                        if (hasTogetherAtTable) continue;
                        
                        // Try removing this student temporarily
                        table.students.splice(i, 1);
                        
                        // Check if new student can go here
                        if (canPlaceAtTable(student, table)) {
                            // Check if booted student can find a spot elsewhere while respecting their together constraints
                            let boostedCanBePlaced = false;
                            for (const otherTable of state.tables) {
                                if (otherTable !== table && otherTable.students.length < otherTable.capacity && canPlaceAtTable(boostedStudent, otherTable)) {
                                    boostedCanBePlaced = true;
                                    otherTable.students.push({ ...boostedStudent, locked: false });
                                    break;
                                }
                            }
                            
                            // If booted student found a spot, accept the swap
                            if (boostedCanBePlaced) {
                                table.students.push({ ...student, locked: false });
                                placed.add(student.id);
                                console.warn(`Rescued ${student.name} - booted ${boostedStudent.name} and swapped`);
                                placed_rescue = true;
                                break;
                            } else {
                                // Booted student couldn't find a spot, restore original state
                                table.students.splice(i, 0, boostedStudent);
                            }
                        } else {
                            // New student can't go here anyway, restore
                            table.students.splice(i, 0, boostedStudent);
                        }
                    }
                    
                    if (placed_rescue) break;
                }
            }
            
            // Last resort: place anywhere if still not placed
            if (!placed_rescue) {
                for (const table of state.tables) {
                    if (table.students.length < table.capacity) {
                        table.students.push({ ...student, locked: false });
                        placed.add(student.id);
                        console.warn(`Rescued ${student.name} - placed in full table as last resort`);
                        placed_rescue = true;
                        break;
                    }
                }
            }
        }
    }

    saveState();
    renderSeatingPlan();
    redrawCanvas();
}

function renderSeatingPlan() {
    const seatingPlan = document.getElementById('seatingPlan');
    
    if (state.tables.length === 0) {
        seatingPlan.innerHTML = '<p style="color: var(--muted); text-align: center;">No tables created</p>';
        return;
    }
    
    seatingPlan.innerHTML = state.tables.map((table, tIdx) => {
        const studentsHtml = table.students.map((s, sIdx) => `
            <div class="seating-student" draggable="true" data-table="${tIdx}" data-student="${sIdx}" style="display: flex; justify-content: space-between; align-items: center; padding: 4px; background: var(--surface-light); margin: 2px 0; border-radius: 3px; cursor: move;">
                <span>${s.name}</span>
                <button class="lock-btn" onclick="toggleStudentLock(${tIdx}, ${sIdx})" title="${s.locked ? 'Unlock student from randomization' : 'Lock student to stay in place'}" style="background: none; border: none; padding: 0; cursor: pointer; color: var(--text-muted); font-size: 12px;">
                    ${s.locked ? '🔒' : '🔓'}
                </button>
            </div>
        `).join('');
        
        return `
            <div class="seating-table">
                <div class="seating-table-title">${table.type === 'square' ? '◻️' : '🔵'} Table ${tIdx + 1}</div>
                <div class="seating-table-students" style="display: flex; flex-direction: column;">
                    ${studentsHtml || '<p style="color: var(--muted); font-size: 12px;">Empty</p>'}
                </div>
            </div>
        `;
    }).join('');
    
    // Add drag listeners
    document.querySelectorAll('.seating-student').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            const tableIdx = parseInt(e.currentTarget.dataset.table);
            const studentIdx = parseInt(e.currentTarget.dataset.student);
            state.draggingStudentFrom = { tableIdx, studentIdx };
            e.dataTransfer.effectAllowed = 'move';
        });
        
        el.addEventListener('dragend', () => {
            state.draggingStudentFrom = null;
        });
    });
    
    document.querySelectorAll('.seating-table-students').forEach((el, idx) => {
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            el.style.borderTop = '2px solid var(--primary)';
        });
        
        el.addEventListener('dragleave', () => {
            el.style.borderTop = 'none';
        });
        
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.style.borderTop = 'none';
            
            if (state.draggingStudentFrom) {
                const { tableIdx: fromIdx, studentIdx } = state.draggingStudentFrom;
                const toIdx = idx;
                
                if (fromIdx !== toIdx) {
                    const student = state.tables[fromIdx].students[studentIdx];
                    state.tables[fromIdx].students.splice(studentIdx, 1);
                    state.tables[toIdx].students.push(student);
                    saveState();
                    saveSeatingPlan();
                    renderSeatingPlan();
                    redrawCanvas();
                }
                state.draggingStudentFrom = null;
            }
        });
    });
}

function toggleStudentLock(tableIdx, studentIdx) {
    if (tableIdx < 0 || tableIdx >= state.tables.length) return;
    if (studentIdx < 0 || studentIdx >= state.tables[tableIdx].students.length) return;
    
    const student = state.tables[tableIdx].students[studentIdx];
    student.locked = !student.locked;
    saveState();
    renderSeatingPlan();
}
function exportPNG() {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `seating-plan-${Date.now()}.png`;
    link.click();
}

function copySeatingPlan() {
    if (!state.currentClass || state.tables.length === 0) {
        alert('No seating plan to copy');
        return;
    }
    
    // Generate text version of seating plan
    const className = state.currentClass.name || state.currentClass;
    let text = `Seating Plan for ${className}\n`;
    text += `${'='.repeat(40)}\n\n`;
    
    state.tables.forEach((table, tIdx) => {
        const tableType = table.type === 'square' ? '◻️ Square' : '🔵 Circle';
        text += `${tableType} Table ${tIdx + 1}:\n`;
        
        if (table.students && table.students.length > 0) {
            table.students.forEach((student, sIdx) => {
                text += `  ${sIdx + 1}. ${student.name}\n`;
            });
        } else {
            text += `  (Empty)\n`;
        }
        text += '\n';
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        const copyBtn = document.getElementById('copySeatingBtn');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            copyBtn.style.backgroundColor = 'var(--success, #10b981)';
            copyBtn.style.color = 'white';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.backgroundColor = '';
                copyBtn.style.color = '';
            }, 1500);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy seating plan');
    });
}

function exportLayout() {
    if (!state.currentClass) {
        alert('Please select a class first');
        return;
    }
    
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 999; cursor: default;
    `;
    backdrop.id = 'exportBackdrop';
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
        padding: 24px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        min-width: 350px; color: var(--text);
    `;
    modal.id = 'exportModal';
    
    modal.innerHTML = `
        <h2 style="margin: 0 0 16px 0; color: var(--text);">Export Layout</h2>
        <p style="color: var(--text-muted); margin-bottom: 12px;">Choose what to export:</p>
        
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                <input type="checkbox" id="exportStudents" checked style="cursor: pointer;" />
                <span>Students</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                <input type="checkbox" id="exportTables" checked style="cursor: pointer;" />
                <span>Tables</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                <input type="checkbox" id="exportText" checked style="cursor: pointer;" />
                <span>Text Objects</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                <input type="checkbox" id="exportConstraints" checked style="cursor: pointer;" />
                <span>Constraints</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text);">
                <input type="checkbox" id="exportSeating" checked style="cursor: pointer;" />
                <span>Seating Plan</span>
            </label>
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button onclick="closeExportModal()" style="padding: 8px 16px; background: var(--surface-light); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; color: var(--text);">Cancel</button>
            <button onclick="performExport(true)" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">Export</button>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    
    backdrop.addEventListener('click', closeExportModal);
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    const backdrop = document.getElementById('exportBackdrop');
    if (modal) modal.remove();
    if (backdrop) backdrop.remove();
}

function performExport(fromModal = false) {
    if (!state.currentClass) return;
    
    // Get checked options from modal
    const exportStudents = document.getElementById('exportStudents')?.checked ?? true;
    const exportTables = document.getElementById('exportTables')?.checked ?? true;
    const exportText = document.getElementById('exportText')?.checked ?? true;
    const exportConstraints = document.getElementById('exportConstraints')?.checked ?? true;
    const exportSeating = document.getElementById('exportSeating')?.checked ?? true;
    
    // Build export data based on selections
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        className: state.currentClass.name,
        data: {}
    };
    
    // Only include students if tables are being exported (students are part of table data)
    if (exportStudents && exportTables) {
        exportData.data.students = state.students;
        exportData.data.tables = state.tables;
    } else if (exportTables) {
        // Export tables but remove students from table data
        exportData.data.tables = state.tables.map(table => {
            const tableCopy = JSON.parse(JSON.stringify(table));
            tableCopy.students = [];
            return tableCopy;
        });
    }
    if (exportText) exportData.data.textObjects = state.textObjects;
    if (exportConstraints) exportData.data.constraints = state.constraints;
    
    // Include seating plan if selected
    if (exportSeating) {
        const key = `seatingPlan_${state.currentClass.id}`;
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            if (saved) exportData.data.seatingPlan = saved;
        } catch {}
    }
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `layout_${state.currentClass.name}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    // Close modal
    closeExportModal();
}

function importLayout() {
    if (!state.currentClass) {
        alert('Please select a class first');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            try {
                const importData = JSON.parse(event.target.result);
                
                if (!importData.data) {
                    alert('Invalid layout file format');
                    return;
                }
                
                // Import selected data
                if (importData.data.students) {
                    state.currentClass.students = importData.data.students;
                    state.students = [...importData.data.students];
                    renderStudentList();
                }
                
                if (importData.data.tables) {
                    state.tables = JSON.parse(JSON.stringify(importData.data.tables));
                }
                
                if (importData.data.textObjects) {
                    state.textObjects = JSON.parse(JSON.stringify(importData.data.textObjects));
                }
                
                if (importData.data.constraints) {
                    state.constraints = JSON.parse(JSON.stringify(importData.data.constraints));
                    renderConstraintsList();
                }
                
                if (importData.data.seatingPlan) {
                    const key = `seatingPlan_${state.currentClass.id}`;
                    setLocalStorage(key, importData.data.seatingPlan);
                }
                
                pushHistory();
                saveState();
                renderSeatingPlan();
                redrawCanvas();
                alert('Layout imported successfully!');
            } catch (err) {
                alert('Error importing layout: ' + err.message);
            }
        });
        
        reader.readAsText(file);
    });
    
    input.click();
}

function copyTable(tableIndex) {
    if (tableIndex < 0 || tableIndex >= state.tables.length) return;
    const table = state.tables[tableIndex];
    state.clipboardTable = JSON.parse(JSON.stringify(table));
}

function pasteTable(x, y) {
    if (!state.clipboardTable) return;
    const newTable = JSON.parse(JSON.stringify(state.clipboardTable));
    newTable.x = x;
    newTable.y = y;
    newTable.students = []; // Clear students when duplicating
    state.tables.push(newTable);
    pushHistory();
    saveState();
    renderSeatingPlan();
    redrawCanvas();
    return state.tables.length - 1;
}

function duplicateTable(tableIndex) {
    if (tableIndex < 0 || tableIndex >= state.tables.length) return;
    const table = state.tables[tableIndex];
    const offset = 30;
    copyTable(tableIndex);
    pasteTable(table.x + offset, table.y + offset);
}

function duplicateTextObject(textIndex) {
    if (textIndex < 0 || textIndex >= state.textObjects.length) return;
    const textObj = state.textObjects[textIndex];
    const offset = 15;
    const newText = JSON.parse(JSON.stringify(textObj));
    newText.x += offset;
    newText.y += offset;
    state.textObjects.push(newText);
    pushHistory();
    saveState();
    redrawCanvas();
}

document.getElementById('newClassBtn').addEventListener('click', () => {
    const name = document.getElementById('classNameInput').value;
    createClass(name);
    document.getElementById('classNameInput').value = '';
});

const addStudentBtn = document.getElementById('addStudentBtn');
if (addStudentBtn) {
    addStudentBtn.addEventListener('click', () => {
        const name = document.getElementById('studentNameInput').value;
        addStudent(name);
        document.getElementById('studentNameInput').value = '';
    });
}

const studentNameInput = document.getElementById('studentNameInput');
if (studentNameInput) {
    studentNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addStudentBtn').click();
        }
    });
}

const classNameInput = document.getElementById('classNameInput');
if (classNameInput) {
    classNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('newClassBtn').click();
        }
    });
}

const squareToolBtn = document.getElementById('squareToolBtn');
const circleToolBtn = document.getElementById('circleToolBtn');
const moveToolBtn = document.getElementById('moveToolBtn');
const duplicateToolBtn = document.getElementById('duplicateToolBtn');
const deleteToolBtn = document.getElementById('deleteToolBtn');
const textToolBtn = document.getElementById('textToolBtn');

function selectTool(toolName, toolDisplay) {
    state.currentTool = toolName;
    state.lastAction = toolDisplay;
    // Clear selection when switching tools
    state.selectedTableIndex = -1;
    state.selectedTextIndex = -1;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btnMap = {
        'square': 'squareToolBtn',
        'circle': 'circleToolBtn',
        'move': 'moveToolBtn',
        'duplicate': 'duplicateToolBtn',
        'hand': 'handToolBtn',
        'delete': 'deleteToolBtn',
        'text': 'textToolBtn',
        'rotate': 'rotateToolBtn',
        'scale': 'scaleToolBtn',
        'bucket': 'bucketToolBtn'
    };
    const btn = document.getElementById(btnMap[toolName]);
    if (btn) btn.classList.add('active');
    if (toolName === 'hand') canvas.style.cursor = 'grab';
    redrawCanvas();
    setTimeout(() => { state.lastAction = null; redrawCanvas(); }, 1500);
}

if (squareToolBtn) {
    squareToolBtn.addEventListener('click', () => selectTool('square', 'Square Tool'));
}

if (circleToolBtn) {
    circleToolBtn.addEventListener('click', () => selectTool('circle', 'Circle Tool'));
}

if (moveToolBtn) {
    moveToolBtn.addEventListener('click', () => selectTool('move', 'Move Tool'));
}

if (duplicateToolBtn) {
    duplicateToolBtn.addEventListener('click', () => selectTool('duplicate', 'Duplicate Tool'));
}

const handToolBtn = document.getElementById('handToolBtn');
if (handToolBtn) {
    handToolBtn.addEventListener('click', () => selectTool('hand', 'Hand Tool'));
}

if (deleteToolBtn) {
    deleteToolBtn.addEventListener('click', () => selectTool('delete', 'Delete Tool'));
}

if (textToolBtn) {
    textToolBtn.addEventListener('click', () => selectTool('text', 'Text Tool'));
}

const peoplePerTable = document.getElementById('peoplePerTable');
if (peoplePerTable) {
    peoplePerTable.addEventListener('change', (e) => {
        state.peoplePerTable = parseInt(e.target.value);
    });
}

// Color picker button and modal
const colorPickerBtn = document.getElementById('colorPickerBtn');
// Colors sorted by ROYGBIV (Red, Orange, Yellow, Green, Blue, Pink, Violet) + Black
const colors = ['#ef4444', '#f97316', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#1f2937'];
const colorNames = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Pink', 'Violet', 'Black'];

if (colorPickerBtn) {
    colorPickerBtn.addEventListener('click', () => {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 999; cursor: default;
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
            padding: 20px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            min-width: 200px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = 'Choose a Color';
        title.style.cssText = 'margin: 0 0 12px 0; color: var(--text);';
        modal.appendChild(title);
        
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;';
        
        colors.forEach((color, idx) => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--border);
                background-color: ${color}; cursor: pointer; padding: 0; transition: transform 0.2s;
            `;
            if (color === state.currentColor) {
                btn.style.border = '3px solid var(--text)';
            }
            btn.title = colorNames[idx];
            btn.addEventListener('click', () => {
                state.currentColor = color;
                colorPickerBtn.style.backgroundColor = color;
                saveState();
                backdrop.remove();
                modal.remove();
            });
            btn.addEventListener('mouseover', () => btn.style.transform = 'scale(1.1)');
            btn.addEventListener('mouseout', () => btn.style.transform = 'scale(1)');
            grid.appendChild(btn);
        });
        
        modal.appendChild(grid);
        
        backdrop.addEventListener('click', () => {
            backdrop.remove();
            modal.remove();
        });
        
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
    });
    
    // Set initial button color
    colorPickerBtn.style.backgroundColor = state.currentColor || '#ef4444';
}

const allowMultipleSelected = document.getElementById('allowMultipleSelected');
if (allowMultipleSelected) {
    allowMultipleSelected.addEventListener('change', (e) => {
        state.allowMultiple = e.target.checked;
    });
}

const snapGridCheckbox = document.getElementById('snapGridCheckbox');
if (snapGridCheckbox) {
    snapGridCheckbox.addEventListener('change', (e) => {
        state.snapToGrid = e.target.checked;
    });
}

const generateSeatingBtn = document.getElementById('generateSeatingBtn');
if (generateSeatingBtn) {
    generateSeatingBtn.addEventListener('click', generateSeatingPlan);
}

const randomizeBtn = document.getElementById('randomizeBtn');
if (randomizeBtn) {
    randomizeBtn.addEventListener('click', generateSeatingPlan);
}

const clearCanvasBtn = document.getElementById('clearCanvasBtn');
if (clearCanvasBtn) {
    clearCanvasBtn.addEventListener('click', () => {
        if (confirm('Clear all tables?')) {
            state.tables = [];
            state.selectedTableIndex = -1;
            saveState();
            renderSeatingPlan();
            redrawCanvas();
        }
    });
}

const exportPngBtn = document.getElementById('exportPngBtn');
if (exportPngBtn) {
    exportPngBtn.addEventListener('click', exportPNG);
}

const copySeatingBtn = document.getElementById('copySeatingBtn');
if (copySeatingBtn) {
    copySeatingBtn.addEventListener('click', copySeatingPlan);
}

const saveSeatingBtn = document.getElementById('saveSeatingBtn');
if (saveSeatingBtn) {
    saveSeatingBtn.addEventListener('click', () => {
        saveSeatingPlan();
        // Show brief feedback
        const originalText = saveSeatingBtn.textContent;
        saveSeatingBtn.textContent = '✓ Saved';
        saveSeatingBtn.style.backgroundColor = 'var(--success, #10b981)';
        setTimeout(() => {
            saveSeatingBtn.textContent = originalText;
            saveSeatingBtn.style.backgroundColor = '';
        }, 1500);
    });
}

const exportLayoutBtn = document.getElementById('exportLayoutBtn');
if (exportLayoutBtn) {
    exportLayoutBtn.addEventListener('click', exportLayout);
}

const importLayoutBtn = document.getElementById('importLayoutBtn');
if (importLayoutBtn) {
    importLayoutBtn.addEventListener('click', importLayout);
}

// Auto-save seating plan every minute
setInterval(() => {
    if (state.currentClass && state.tables.length > 0) {
        saveSeatingPlan();
    }
}, 60000);

// FAQ Help functionality
const helpBtn = document.getElementById('helpBtn');
if (helpBtn) {
    helpBtn.addEventListener('click', () => {
        showFAQ();
    });
}

function showFAQ() {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 999; cursor: default;
    `;
    backdrop.id = 'faqBackdrop';
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
        padding: 24px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; color: var(--text);
    `;
    modal.id = 'faqModal';
    
    modal.innerHTML = `
        <h2 style="margin: 0 0 16px 0; color: var(--text);">FAQ & Help</h2>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div>
                <h3 style="margin: 0 0 8px 0; color: var(--primary); font-size: 14px;">Where are the names stored?</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 13px;">The names are stored only on your device specifically in your browser's cache (localStorage). No one else has access to your data. When you clear your browser cache, the data will be deleted.</p>
            </div>
            
            <div>
                <h3 style="margin: 0 0 8px 0; color: var(--primary); font-size: 14px;">How do I randomize seating?</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 13px;">After creating tables and adding students, click the red "RANDOMIZE!" button to automatically assign students to tables. You can use constraints (Separate/Together) to keep certain students apart or together.</p>
            </div>
            
            <div>
                <h3 style="margin: 0 0 8px 0; color: var(--primary); font-size: 14px;">How do I save my layout?</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Click the "⬇️ Export Layout" button to download your layout as a JSON file. Use "⬆️ Import Layout" to restore it later. Your seating plan is automatically saved to your device.</p>
            </div>
            
            <div>
                <h3 style="margin: 0 0 8px 0; color: var(--primary); font-size: 14px;">How do I change table colors?</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Use the color picker button (colored circle) in the Tools section. Select a color, then use the Paint Bucket tool (P key) to click on a table to change its color.</p>
            </div>
            
            <div>
                <h3 style="margin: 0 0 8px 0; color: var(--primary); font-size: 14px;">What keyboard shortcuts are available?</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 13px;"><strong>S</strong>=Square, <strong>C</strong>=Circle, <strong>M</strong>=Move, <strong>D</strong>=Duplicate, <strong>G</strong>=Delete, <strong>H</strong>=Hand, <strong>T</strong>=Text, <strong>R</strong>=Rotate, <strong>B</strong>=Scale, <strong>P</strong>=Paint Bucket. Use <strong>Ctrl+Z</strong> to undo and <strong>Ctrl+Y</strong> to redo. Use <strong>Ctrl+C</strong> to copy and <strong>Ctrl+V</strong> to paste selected objects. Press <strong>Delete</strong> or <strong>Backspace</strong> to delete selected objects.</p>
            </div>
            
            <div>
                <h3 style="margin: 0 0 8px 0; color: var(--primary); font-size: 14px;">How do I drag students in the seating plan?</h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 13px;">In the "Seating Plan" section on the left, you can drag any student name from one table to another. You can also lock students (🔒) to prevent them from being randomized.</p>
            </div>
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button onclick="closeFAQ()" style="padding: 8px 16px; background: var(--surface-light); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; color: var(--text);">Close</button>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    
    backdrop.addEventListener('click', closeFAQ);
}

function closeFAQ() {
    const modal = document.getElementById('faqModal');
    const backdrop = document.getElementById('faqBackdrop');
    if (modal) modal.remove();
    if (backdrop) backdrop.remove();
}

const addSeparateBtn = document.getElementById('addSeparateBtn');
const addTogetherBtn = document.getElementById('addTogetherBtn');

if (addSeparateBtn) {
    addSeparateBtn.addEventListener('click', () => {
        state.constraintType = 'separate';
        addSeparateBtn.classList.add('active');
        if (addTogetherBtn) addTogetherBtn.classList.remove('active');
    });
}

if (addTogetherBtn) {
    addTogetherBtn.addEventListener('click', () => {
        state.constraintType = 'together';
        addTogetherBtn.classList.add('active');
        if (addSeparateBtn) addSeparateBtn.classList.remove('active');
    });
}


canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.scale - state.pan.x;
    const y = (e.clientY - rect.top) / state.scale - state.pan.y;
    
    if (e.button === 2) {
        state.panStart = { x: e.clientX, y: e.clientY, panX: state.pan.x, panY: state.pan.y };
        return;
    }
    
    if (e.button !== 0) return;
    
    if (state.currentTool === 'hand' || state.spacePressed) {
        state.panStart = { x: e.clientX, y: e.clientY, panX: state.pan.x, panY: state.pan.y };
        canvas.style.cursor = 'grabbing';
        return;
    }
    
    // Default tool - handle text and table selection/manipulation
    if (!state.currentTool || state.currentTool === 'select') {
        const tableIdx = getTableAt(x, y);
        if (tableIdx >= 0) {
            state.selectedTableIndex = tableIdx;
            state.draggingTableIndex = tableIdx;
            redrawCanvas();
            return;
        }
        const textIdx = getTextAt(e.clientX - rect.left, e.clientY - rect.top);
        if (textIdx >= 0) {
            state.selectedTextIndex = textIdx;
            state.draggingTextIndex = textIdx;
            redrawCanvas();
            return;
        }
        return;
    }
    
    if (state.currentTool === 'move' || state.currentTool === 'duplicate') {
        const tableIdx = getTableAt(x, y);
        if (tableIdx >= 0) {
            if (state.currentTool === 'duplicate') {
                duplicateTable(tableIdx);
                return;
            }
            state.draggingTableIndex = tableIdx;
            state.selectedTableIndex = tableIdx;
            redrawCanvas();
            return;
        }
        const textIdx = getTextAt(e.clientX - rect.left, e.clientY - rect.top);
        if (textIdx >= 0) {
            if (state.currentTool === 'duplicate') {
                duplicateTextObject(textIdx);
                return;
            }
            state.draggingTextIndex = textIdx;
            state.selectedTextIndex = textIdx;
            redrawCanvas();
            return;
        }
        return;
    }
    
    if (state.currentTool === 'delete') {
        const tableIdx = getTableAt(x, y);
        if (tableIdx >= 0) {
            deleteTable(tableIdx);
            return;
        }
        const textIdx = getTextAt(e.clientX - rect.left, e.clientY - rect.top);
        if (textIdx >= 0) {
            deleteTextObject(textIdx);
        }
        return;
    }
    
    if (state.currentTool === 'rotate') {
        const tableIdx = getTableAt(x, y);
        if (tableIdx >= 0) {
            state.selectedTableIndex = tableIdx;
            const table = state.tables[tableIdx];
            state.rotationStart = {
                tableIdx: tableIdx,
                startAngle: Math.atan2(y - table.y, x - table.x),
                isText: false
            };
            redrawCanvas();
            return;
        }
        // Check if rotating text
        const textIdx = getTextAt(e.clientX - rect.left, e.clientY - rect.top);
        if (textIdx >= 0) {
            state.selectedTextIndex = textIdx;
            const textObj = state.textObjects[textIdx];
            state.rotationStart = {
                textIdx: textIdx,
                startAngle: Math.atan2(y - textObj.y, x - textObj.x),
                isText: true
            };
            redrawCanvas();
            return;
        }
        return;
    }
    
    if (state.currentTool === 'scale') {
        const tableIdx = getTableAt(x, y);
        if (tableIdx >= 0) {
            state.selectedTableIndex = tableIdx;
            const table = state.tables[tableIdx];
            state.scaleStart = {
                tableIdx: tableIdx,
                startX: x,
                startY: y,
                originalWidth: table.width || 50,
                originalHeight: table.height || 50,
                originalRadius: table.radius || 30,
                isText: false
            };
            redrawCanvas();
            return;
        }
        // Check if clicking on text object
        const textIdx = getTextAt(e.clientX - rect.left, e.clientY - rect.top);
        if (textIdx >= 0) {
            state.selectedTextIndex = textIdx;
            const textObj = state.textObjects[textIdx];
            state.scaleStart = {
                textIdx: textIdx,
                startX: x,
                startY: y,
                originalFontSize: textObj.fontSize || 14,
                isText: true
            };
            redrawCanvas();
            return;
        }
        return;
    }
    
    if (state.currentTool === 'bucket') {
        // Paint bucket tool - change color of clicked element
        const tableIdx = getTableAt(x, y);
        if (tableIdx >= 0) {
            state.tables[tableIdx].color = state.currentColor;
            pushHistory();
            saveState();
            redrawCanvas();
            return;
        }
        const textIdx = getTextAt(e.clientX - rect.left, e.clientY - rect.top);
        if (textIdx >= 0) {
            state.textObjects[textIdx].color = state.currentColor;
            pushHistory();
            saveState();
            redrawCanvas();
            return;
        }
        return;
    }
    
    if (state.currentTool === 'text') {
        // Create simple text input modal
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.3); z-index: 1998; cursor: default;
        `;
        backdrop.id = 'textInputBackdrop';
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: var(--surface); border: 2px solid #3b82f6; border-radius: 8px;
            padding: 24px; z-index: 1999; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 300px; color: var(--text);
        `;
        modal.id = 'textInputModal';
        
        modal.innerHTML = `
            <p style="margin: 0 0 12px 0; color: var(--text);">Enter text (press Enter to confirm):</p>
            <input id="textInputField" type="text" placeholder="Type text..." style="
                width: 100%; padding: 10px; font-size: 14px; border: 1px solid var(--border);
                border-radius: 4px; box-sizing: border-box; color: var(--text);
                background: var(--surface-light);
            " />
        `;
        
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
        
        const input = document.getElementById('textInputField');
        state.isTyping = true;
        
        // Auto-select the text field after DOM is ready
        setTimeout(() => {
            input.focus();
            input.select();
        }, 10);
        
        function finishText() {
            const text = input.value.trim();
            if (text) {
                state.textObjects.push({
                    x: x,
                    y: y,
                    text: text,
                    fontSize: 14,
                    color: '#000000',
                    rotation: 0
                });
                pushHistory();
                saveState();
            }
            state.isTyping = false;
            state.currentTool = 'select';
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            if (modal.parentNode) modal.parentNode.removeChild(modal);
            redrawCanvas();
        }
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                finishText();
                e.preventDefault();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                state.isTyping = false;
                if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
                if (modal.parentNode) modal.parentNode.removeChild(modal);
                redrawCanvas();
            }
        });
        
        backdrop.addEventListener('click', () => {
            finishText();
        });
        
        return;
    }
    
    state.isDrawing = true;
    state.startX = x;
    state.startY = y;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.scale - state.pan.x;
    const y = (e.clientY - rect.top) / state.scale - state.pan.y;
    
    state.currentMouseX = e.clientX - rect.left;
    state.currentMouseY = e.clientY - rect.top;
    
    if (state.panStart) {
        state.pan.x = state.panStart.panX + (e.clientX - state.panStart.x) / state.scale;
        state.pan.y = state.panStart.panY + (e.clientY - state.panStart.y) / state.scale;
        redrawCanvas();
        return;
    }
    
    if (state.rotationStart) {
        if (state.rotationStart.isText) {
            const textObj = state.textObjects[state.rotationStart.textIdx];
            const angle = Math.atan2(y - textObj.y, x - textObj.x);
            textObj.rotation = angle - state.rotationStart.startAngle;
        } else {
            const table = state.tables[state.rotationStart.tableIdx];
            const angle = Math.atan2(y - table.y, x - table.x);
            table.rotation = angle - state.rotationStart.startAngle;
        }
        redrawCanvas();
        return;
    }
    
    if (state.scaleStart) {
        const deltaX = x - state.scaleStart.startX;
        const deltaY = y - state.scaleStart.startY;
        
        // Check if scaling a text object
        if (state.scaleStart.isText) {
            const textObj = state.textObjects[state.scaleStart.textIdx];
            const scale = 1 + (deltaX + deltaY) * 0.01;
            const newSize = state.scaleStart.originalFontSize * scale;
            textObj.fontSize = Math.max(6, Math.min(72, newSize));
        } else {
            const table = state.tables[state.scaleStart.tableIdx];
            // Shift key for uniform scaling
            if (e.shiftKey) {
                const scale = 1 + (deltaX + deltaY) * 0.01;
                if (table.type === 'square') {
                    table.width = Math.max(20, state.scaleStart.originalWidth * scale);
                    table.height = Math.max(20, state.scaleStart.originalHeight * scale);
                } else if (table.type === 'circle') {
                    table.radius = Math.max(10, state.scaleStart.originalRadius * scale);
                }
            } else {
                if (table.type === 'square') {
                    table.width = Math.max(20, state.scaleStart.originalWidth + deltaX);
                    table.height = Math.max(20, state.scaleStart.originalHeight + deltaY);
                } else if (table.type === 'circle') {
                    table.radius = Math.max(10, state.scaleStart.originalRadius + (deltaX + deltaY) * 0.5);
                }
            }
        }
        redrawCanvas();
        return;
    }
    
    if (state.draggingTableIndex >= 0) {
        moveTable(state.draggingTableIndex, x, y);
        return;
    }
    
    if (state.draggingTextIndex >= 0) {
        moveTextObject(state.draggingTextIndex, x, y);
        return;
    }
    
    if (state.isDrawing) {
        redrawCanvas();
    }
});

canvas.addEventListener('mouseup', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.scale - state.pan.x;
    const y = (e.clientY - rect.top) / state.scale - state.pan.y;
    
    // Push history for completed operations (drag, rotate, scale)
    if (state.draggingTableIndex >= 0 || state.draggingTextIndex >= 0 || 
        state.rotationStart !== null || state.scaleStart !== null) {
        pushHistory();
        saveState();
    }
    
    state.panStart = null;
    state.draggingTableIndex = -1;
    state.draggingTextIndex = -1;
    state.rotationStart = null;
    state.scaleStart = null;
    state.rotationStart = null;
    state.scaleStart = null;
    state.draggingTextIndex = -1;
    
    if (!state.isDrawing) return;
    state.isDrawing = false;
    
    const width = Math.abs(x - state.startX);
    const height = Math.abs(y - state.startY);
    
    if (width < 10 || height < 10) return;
    
    const minX = Math.min(state.startX, x);
    const minY = Math.min(state.startY, y);
    
    const newTable = {
        type: state.currentTool,
        x: minX,
        y: minY,
        capacity: state.peoplePerTable,
        students: [],
        locked: false,
        color: state.currentColor,
        rotation: 0
    };
    
    if (state.currentTool === 'square') {
        // Uniform scaling with Shift key
        const size = Math.min(width, height);
        newTable.width = e.shiftKey ? size : width;
        newTable.height = e.shiftKey ? size : height;
        
        // Snap to grid if enabled
        if (state.snapToGrid) {
            const gridSize = 20;
            // Snap position to grid
            newTable.x = Math.round(newTable.x / gridSize) * gridSize;
            newTable.y = Math.round(newTable.y / gridSize) * gridSize;
            // Snap size to grid with minimum of 1 grid unit (20px)
            newTable.width = Math.max(gridSize, Math.round(newTable.width / gridSize) * gridSize);
            newTable.height = Math.max(gridSize, Math.round(newTable.height / gridSize) * gridSize);
        }
    } else if (state.currentTool === 'circle') {
        newTable.radius = Math.max(width, height) / 2;
    }
    
    if (state.currentTool === 'square' || state.currentTool === 'circle') {
        state.tables.push(newTable);
        pushHistory();
        saveState();
        renderSeatingPlan();
        redrawCanvas();
    }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        state.spacePressed = true;
        canvas.style.cursor = 'grab';
    }
    
    // Undo (Ctrl+Z)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    
    // Redo (Ctrl+Y)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (state.selectedTableIndex >= 0) {
            copyTable(state.selectedTableIndex);
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (state.clipboardTable) {
            const offset = 40;
            const baseX = state.clipboardTable.x + offset;
            const baseY = state.clipboardTable.y + offset;
            pasteTable(baseX, baseY);
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        state.spacePressed = false;
        if (state.currentTool !== 'hand') {
            canvas.style.cursor = 'crosshair';
        }
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = state.scale;
    state.scale *= delta;
    state.scale = Math.max(0.1, Math.min(5, state.scale));
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / oldScale - state.pan.x;
    const mouseY = (e.clientY - rect.top) / oldScale - state.pan.y;
    
    state.pan.x = (e.clientX - rect.left) / state.scale - mouseX;
    state.pan.y = (e.clientY - rect.top) / state.scale - mouseY;
    
    redrawCanvas();
});

function updateUI() {
    const hasClass = state.currentClass !== null;
    const hasTables = state.tables.length > 0;
    const hasStudents = state.students.length > 0;
    
    const shouldShowButtons = hasClass && hasTables && hasStudents;
    document.getElementById('generateSeatingBtn').style.display = 'block';
    document.getElementById('randomizeBtn').style.display = shouldShowButtons ? 'block' : 'none';
    document.getElementById('clearCanvasBtn').style.display = hasTables ? 'block' : 'none';
}

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 250);
});

// Bulk student import modal
const bulkAddBtn = document.getElementById('bulkAddBtn');
if (bulkAddBtn) {
    bulkAddBtn.addEventListener('click', () => {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 999;
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: var(--surface); border: 1px solid var(--border);
            border-radius: 8px; padding: 20px; z-index: 1000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); min-width: 400px;
        `;
        
        modal.innerHTML = `
            <h3 style="color: var(--text); margin-bottom: 15px;">Bulk Add Students</h3>
            <label style="color: var(--text-muted); font-size: 12px; display: block; margin-bottom: 8px;">Paste names (space or comma separated):</label>
            <textarea id="bulkTextArea" style="width: 100%; height: 100px; padding: 8px; background-color: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; color: var(--text); margin-bottom: 15px; font-family: monospace; font-size: 13px; resize: none;"></textarea>
            
            <label style="color: var(--text-muted); font-size: 12px; display: block; margin-bottom: 8px;">Or upload file (.txt, .csv):</label>
            <input type="file" id="bulkFileInput" accept=".txt,.csv" style="display: block; margin-bottom: 15px; font-size: 12px;" />
            
            <div style="display: flex; gap: 10px;">
                <button id="bulkAddCancel" style="flex: 1; padding: 8px; background-color: var(--secondary); border: none; border-radius: 6px; color: var(--text); cursor: pointer; font-weight: 500;">Cancel</button>
                <button id="bulkAddConfirm" style="flex: 1; padding: 8px; background-color: var(--success); border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">Add</button>
            </div>
        `;
        
        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
        
        const textarea = modal.querySelector('#bulkTextArea');
        const fileInput = modal.querySelector('#bulkFileInput');
        
        const closeModal = () => {
            backdrop.remove();
            modal.remove();
        };
        
        backdrop.addEventListener('click', closeModal);
        modal.querySelector('#bulkAddCancel').addEventListener('click', closeModal);
        
        modal.querySelector('#bulkAddConfirm').addEventListener('click', async () => {
            const textNames = textarea.value.split(/[\s,\n]+/).filter(n => n.trim().length > 0);
            textNames.forEach(name => addStudent(name.trim()));
            
            if (fileInput.files[0]) {
                const file = fileInput.files[0];
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
                lines.forEach(line => {
                    const name = line.trim();
                    if (name && name.length > 0) addStudent(name);
                });
            }
            
            closeModal();
        });
        
        textarea.focus();
    });
}

// Color picker
const colorPicker = document.getElementById('colorPicker');
if (colorPicker) {
    colorPicker.addEventListener('change', (e) => {
        state.currentColor = e.target.value;
    });
}

// New tool buttons
const rotateToolBtn = document.getElementById('rotateToolBtn');
const scaleToolBtn = document.getElementById('scaleToolBtn');

if (rotateToolBtn) {
    rotateToolBtn.addEventListener('click', () => {
        selectTool('rotate', 'Rotate Tool');
        canvas.style.cursor = 'cell';
    });
}

if (scaleToolBtn) {
    scaleToolBtn.addEventListener('click', () => {
        selectTool('scale', 'Scale Tool');
        canvas.style.cursor = 'nwse-resize';
    });
}

// Bucket tool button
const bucketToolBtn = document.getElementById('bucketToolBtn');
if (bucketToolBtn) {
    bucketToolBtn.addEventListener('click', () => {
        selectTool('bucket', 'Paint Bucket');
        canvas.style.cursor = 'crosshair';
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Only process shortcuts when not typing in an input
    const isTyping = document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text';
    if (isTyping) return;
    
    // Prevent tool selection when Ctrl+C is pressed (copy command)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        return;
    }
    
    const keyMap = {
        's': 'square', 'S': 'square',
        'c': 'circle', 'C': 'circle',
        'm': 'move', 'M': 'move',
        'd': 'duplicate', 'D': 'duplicate',
        'g': 'delete', 'G': 'delete',
        'h': 'hand', 'H': 'hand',
        't': 'text', 'T': 'text',
        'r': 'rotate', 'R': 'rotate',
        'b': 'scale', 'B': 'scale',
        'p': 'bucket', 'P': 'bucket',
    };
    
    // Check if currently in text input mode
    if (state.isTyping) return;
    
    if (keyMap[e.key]) {
        e.preventDefault();
        const tool = keyMap[e.key];
        state.currentTool = tool;
        
        // Update button UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tool === tool) {
                btn.classList.add('active');
            }
        });
        
        // Update cursor
        if (tool === 'hand') canvas.style.cursor = 'grab';
        else if (tool === 'rotate') canvas.style.cursor = 'cell';
        else if (tool === 'scale') canvas.style.cursor = 'nwse-resize';
        else if (tool === 'delete') canvas.style.cursor = 'pointer';
        else canvas.style.cursor = 'crosshair';
    }
    
    // Delete/Backspace to delete selection
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        e.preventDefault();
        if (state.selectedTableIndex >= 0) {
            deleteTable(state.selectedTableIndex);
        } else if (state.selectedTextIndex >= 0) {
            deleteTextObject(state.selectedTextIndex);
        }
    }
});

resizeCanvas();
loadState();

// Collapsible sections functionality
function toggleSection(headerElement) {
    const sectionContent = headerElement.nextElementSibling;
    const toggle = headerElement.querySelector('.section-toggle');
    
    headerElement.classList.toggle('collapsed');
    sectionContent.classList.toggle('collapsed');
    
    // Save preference to localStorage
    const sectionName = headerElement.parentElement.querySelector('h2').textContent;
    const isCollapsed = headerElement.classList.contains('collapsed');
    localStorage.setItem(`sectionCollapsed_${sectionName}`, isCollapsed);
}

// Load collapsed state on page load
document.querySelectorAll('.section-header').forEach(header => {
    const sectionName = header.querySelector('h2').textContent;
    const isCollapsed = localStorage.getItem(`sectionCollapsed_${sectionName}`) === 'true';
    
    if (isCollapsed) {
        header.classList.add('collapsed');
        header.nextElementSibling.classList.add('collapsed');
    }
});

if (state.classes.length > 0) {
    selectClass(state.classes[0].id);
}
updateUI();
