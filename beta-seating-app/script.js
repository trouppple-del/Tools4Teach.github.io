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
    historyIndex: -1,
    alphabeticalSeating: false,
    evenDistribution: false
};

const APP_VERSION = '1.0';

async function loadHTMLFragment(url, containerId) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        document.getElementById(containerId).innerHTML = html;
    } catch (error) {
        console.error('Error loading HTML fragment:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadHTMLFragment('seating-plan.html', 'seating-plan-content');
    await loadHTMLFragment('groups-wheel.html', 'groups-wheel-content');

    state.classes = getLocalStorage('seatingAppClasses', []);
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    setupCanvasEvents();
    if (state.classes.length > 0) {
        selectClass(state.classes[0].id);
    }
    updateUI();
}

function setupCanvasEvents() {
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
            const textIdx = getTextAt(e.clientX - rect.left, e.clientY - rect.top);
            const isEditing = textIdx >= 0;

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

            const currentText = isEditing ? state.textObjects[textIdx].text : '';
            const labelText = isEditing ? 'Edit text (press Enter to confirm):' : 'Enter text (press Enter to confirm):';

            modal.innerHTML = `
                <p style="margin: 0 0 12px 0; color: var(--text);">${labelText}</p>
                <input id="textInputField" type="text" placeholder="Type text..." style="
                    width: 100%; padding: 10px; font-size: 14px; border: 1px solid var(--border);
                    border-radius: 4px; box-sizing: border-box; color: var(--text);
                    background: var(--surface-light);
                " value="${currentText}" />
            `;

            document.body.appendChild(backdrop);
            document.body.appendChild(modal);

            const input = document.getElementById('textInputField');
            state.isTyping = true;

            setTimeout(() => {
                input.focus();
                input.select();
            }, 10);

            function finishText() {
                const text = input.value.trim();
                if (text) {
                    if (isEditing) {
                        state.textObjects[textIdx].text = text;
                    } else {
                        state.textObjects.push({
                            x: x,
                            y: y,
                            text: text,
                            fontSize: 14,
                            color: '#000000',
                            rotation: 0
                        });
                    }
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

            if (state.scaleStart.isText) {
                const textObj = state.textObjects[state.scaleStart.textIdx];
                const scale = 1 + (deltaX + deltaY) * 0.01;
                const newSize = state.scaleStart.originalFontSize * scale;
                textObj.fontSize = Math.max(6, Math.min(72, newSize));
            } else {
                const table = state.tables[state.scaleStart.tableIdx];
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
            const size = Math.min(width, height);
            newTable.width = e.shiftKey ? size : width;
            newTable.height = e.shiftKey ? size : height;

            if (state.snapToGrid) {
                const gridSize = 20;
                newTable.x = Math.round(newTable.x / gridSize) * gridSize;
                newTable.y = Math.round(newTable.y / gridSize) * gridSize;
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
            if (!state.isTyping) {
                e.preventDefault();
                state.spacePressed = true;
                canvas.style.cursor = 'grab';
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
        }
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

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 250);
    });
}

function moveTable(tableIndex, newX, newY) {
    if (tableIndex < 0 || tableIndex >= state.tables.length) return;

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
        const fontSize = textObj.fontSize || 14;
        const objX = (textObj.x + state.pan.x) * state.scale;
        const objY = (textObj.y + state.pan.y) * state.scale;

        const metrics = ctx.measureText(textObj.text);
        const width = metrics.width + 8;
        const height = fontSize + 8;

        if (x >= objX - 12 && x <= objX + width + 12 &&
            y >= objY - 12 && y <= objY + height + 12) {
            return i;
        }
    }
    return -1;
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
    newTable.students = [];
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

    let text = `Seating Plan for ${state.currentClass.name || state.currentClass}\n`;
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

    const exportStudents = document.getElementById('exportStudents')?.checked ?? true;
    const exportTables = document.getElementById('exportTables')?.checked ?? true;
    const exportText = document.getElementById('exportText')?.checked ?? true;
    const exportConstraints = document.getElementById('exportConstraints')?.checked ?? true;
    const exportSeating = document.getElementById('exportSeating')?.checked ?? true;

    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        className: state.currentClass.name,
        data: {}
    };

    if (exportStudents && exportTables) {
        exportData.data.students = state.students;
        exportData.data.tables = state.tables;
    } else if (exportTables) {
        exportData.data.tables = state.tables.map(table => {
            const tableCopy = JSON.parse(JSON.stringify(table));
            tableCopy.students = [];
            return tableCopy;
        });
    }
    if (exportText) exportData.data.textObjects = state.textObjects;
    if (exportConstraints) exportData.data.constraints = state.constraints;

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

