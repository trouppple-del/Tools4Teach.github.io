function createClass(name) {
    if (!name || name.trim().length === 0) return;
    
    const newClass = {
        id: Date.now(),
        name: name.trim(),
        students: [],
        tables: [],
        textObjects: [],
        constraints: []
    };
    
    state.classes.push(newClass);
    saveState();
    renderClassList();
}

function selectClass(classId) {
    const cls = state.classes.find(c => c.id === classId);
    if (!cls) return;
    
    state.currentClass = cls;
    state.students = cls.students || [];
    state.tables = cls.tables || [];
    state.textObjects = cls.textObjects || [];
    state.constraints = cls.constraints || [];
    
    loadSeatingPlan();
    renderClassList();
    renderStudentList();
    renderConstraintsList();
    updateUI();
    redrawCanvas();
}

function deleteClass(classId) {
    state.classes = state.classes.filter(c => c.id !== classId);
    if (state.currentClass?.id === classId) {
        state.currentClass = null;
        state.students = [];
        state.tables = [];
        state.textObjects = [];
        state.constraints = [];
    }
    saveState();
    renderClassList();
    updateUI();
    redrawCanvas();
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
    if (!state.currentClass || !name || name.trim().length === 0) return;

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
    
    const seen = new Set();
    const deduplicatedConstraints = [];
    
    for (const constraint of state.constraints) {
        const key = constraint.student1 < constraint.student2 
            ? `${constraint.student1}-${constraint.student2}` 
            : `${constraint.student2}-${constraint.student1}`;
        
        if (!seen.has(key)) {
            seen.add(key);
            deduplicatedConstraints.push(constraint);
        }
    }
    
    if (deduplicatedConstraints.length !== state.constraints.length) {
        state.constraints = deduplicatedConstraints;
        if (state.currentClass) {
            state.currentClass.constraints = deduplicatedConstraints;
        }
        setLocalStorage('seatingAppClasses', state.classes);
    }
    
    if (deduplicatedConstraints.length === 0) {
        constraintsList.innerHTML = '<div class="add-constraint" onclick="showConstraintModal()">+ Add Constraint</div>';
        return;
    }
    
    const html = deduplicatedConstraints.map((constraint, idx) => {
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
        color: var(--text);
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
    });
    
    select2.addEventListener('change', (e) => {
        selectedIdx2 = parseInt(e.target.value);
    });
    
    modal.querySelector('#cancelBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('#addBtn').addEventListener('click', () => {
        if (selectedIdx1 === selectedIdx2) {
            alert('Select two different students');
            return;
        }
        
        addConstraint(state.students[selectedIdx1].id, state.students[selectedIdx2].id);
        modal.remove();
    });
}

function updateUI() {
    const hasClass = state.currentClass !== null;
    const hasTables = state.tables.length > 0;
    const hasStudents = state.students.length > 0;
    
    const shouldShowButtons = hasClass && hasTables && hasStudents;
    document.getElementById('generateSeatingBtn').style.display = 'block';
    document.getElementById('randomizeBtn').style.display = shouldShowButtons ? 'block' : 'none';
    document.getElementById('clearCanvasBtn').style.display = hasTables ? 'block' : 'none';
}