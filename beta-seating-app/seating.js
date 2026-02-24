function canPlaceAtTable(student, table) {
    const hasSeparationViolation = state.constraints.some(c =>
        c.type === 'separate' &&
        (
            (c.student1 === student.id && table.students.some(ts => ts.id === c.student2)) ||
            (c.student2 === student.id && table.students.some(ts => ts.id === c.student1))
        )
    );
    
    if (hasSeparationViolation) return false;
    
    const togetherConstraints = state.constraints.filter(c =>
        c.type === 'together' &&
        (c.student1 === student.id || c.student2 === student.id)
    );
    
    for (const constraint of togetherConstraints) {
        const partnerId = constraint.student1 === student.id ? constraint.student2 : constraint.student1;
        const partnerAtTable = table.students.some(ts => ts.id === partnerId);
        
        const partnerPlaced = state.tables.some(t => t.students.some(st => st.id === partnerId));
        
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

    const togetherStudentIds = new Set();
    for (const c of state.constraints) {
        if (c.type === 'together') {
            togetherStudentIds.add(c.student1);
            togetherStudentIds.add(c.student2);
        }
    }
    state.tables.forEach(t => {
        t.students = t.students.filter(s => s.locked && !togetherStudentIds.has(s.id));
    });

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

    for (const group of togetherGroups) {
        const members = group
            .map(id => state.students.find(s => s.id === id))
            .filter(s => !placed.has(s.id));

        if (members.length === 0) continue;

        let foundTable = false;
        const tablesToCheck = state.evenDistribution 
            ? [...state.tables].sort((a, b) => a.students.length - b.students.length)
            : [...state.tables].sort(() => Math.random() - 0.5);
        
        for (const table of tablesToCheck) {
            const space = table.capacity - table.students.length;
            if (space < members.length) continue;

            let valid = true;
            for (const member of members) {
                if (!canPlaceAtTable(member, table)) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                for (const member of members) {
                    table.students.push({ ...member, locked: false });
                    placed.add(member.id);
                }
                foundTable = true;
                break;
            }
        }
    }

    const unplaced = state.students.filter(s => !placed.has(s.id));
    
    if (state.alphabeticalSeating) {
        unplaced.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        for (let i = unplaced.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unplaced[i], unplaced[j]] = [unplaced[j], unplaced[i]];
        }
    }

    for (const student of unplaced) {
        let placed_here = false;

        if (group) {
            for (const memberId of group) {
                if (memberId === student.id) continue;
                
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

        if (!placed_here) {
            const tablesToCheck = state.evenDistribution 
                ? [...state.tables].sort((a, b) => a.students.length - b.students.length)
                : [...state.tables].sort(() => Math.random() - 0.5);
            
            for (const table of tablesToCheck) {
                if (table.students.length < table.capacity && canPlaceAtTable(student, table)) {
                    table.students.push({ ...student, locked: false });
                    placed.add(student.id);
                    break;
                }
            }
        }
    }

    const stillUnplaced = state.students.filter(s => !placed.has(s.id));
    
    if (stillUnplaced.length > 0) {
        console.warn(`${stillUnplaced.length} students couldn't be placed with constraints. Attempting rescue placement...`);
        
        for (const student of stillUnplaced) {
            let placed_rescue = false;
            
            for (const table of state.tables) {
                if (table.students.length < table.capacity && canPlaceAtTable(student, table)) {
                    table.students.push({ ...student, locked: false });
                    placed.add(student.id);
                    console.warn(`Rescued ${student.name} - placed in valid table with space`);
                    placed_rescue = true;
                    break;
                }
            }
            
            if (!placed_rescue) {
                for (const table of state.tables) {
                    for (let i = 0; i < table.students.length; i++) {
                        const boostedStudent = table.students[i];
                        
                        if (boostedStudent.locked) continue;
                        
                        const hasTogetherAtTable = state.constraints.some(c =>
                            c.type === 'together' &&
                            ((c.student1 === boostedStudent.id && table.students.some((s, idx) => idx !== i && s.id === c.student2)) ||
                             (c.student2 === boostedStudent.id && table.students.some((s, idx) => idx !== i && s.id === c.student1)))
                        );
                        
                        if (hasTogetherAtTable) continue;
                        
                        table.students.splice(i, 1);
                        
                        if (canPlaceAtTable(student, table)) {
                            let boostedCanBePlaced = false;
                            for (const otherTable of state.tables) {
                                if (otherTable !== table && otherTable.students.length < otherTable.capacity && canPlaceAtTable(boostedStudent, otherTable)) {
                                    boostedCanBePlaced = true;
                                    otherTable.students.push({ ...boostedStudent, locked: false });
                                    break;
                                }
                            }
                            
                            if (boostedCanBePlaced) {
                                table.students.push({ ...student, locked: false });
                                placed.add(student.id);
                                console.warn(`Rescued ${student.name} - booted ${boostedStudent.name} and swapped`);
                                placed_rescue = true;
                                break;
                            } else {
                                table.students.splice(i, 0, boostedStudent);
                            }
                        } else {
                            table.students.splice(i, 0, boostedStudent);
                        }
                    }
                    
                    if (placed_rescue) break;
                }
            }
            
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