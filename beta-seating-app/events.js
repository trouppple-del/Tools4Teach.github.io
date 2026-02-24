function setupEventListeners() {
    const classNameInput = document.getElementById('classNameInput');
    if (classNameInput) {
        classNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                createClass(classNameInput.value);
                classNameInput.value = '';
            }
        });
    }

    const newClassBtn = document.getElementById('newClassBtn');
    if (newClassBtn) {
        newClassBtn.addEventListener('click', () => {
            createClass(classNameInput.value);
            classNameInput.value = '';
        });
    }

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

    const addSeparateBtn = document.getElementById('addSeparateBtn');
    const addTogetherBtn = document.getElementById('addTogetherBtn');

    if (addSeparateBtn) {
        addSeparateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.constraintType = 'separate';
            addSeparateBtn.classList.add('active');
            if (addTogetherBtn) addTogetherBtn.classList.remove('active');
            showConstraintModal();
        });
    }

    if (addTogetherBtn) {
        addTogetherBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.constraintType = 'together';
            addTogetherBtn.classList.add('active');
            if (addSeparateBtn) addSeparateBtn.classList.remove('active');
            showConstraintModal();
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

    const colorPickerBtn = document.getElementById('colorPickerBtn');
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

    const alphabeticalSeatingCheckbox = document.getElementById('alphabeticalSeating');
    if (alphabeticalSeatingCheckbox) {
        alphabeticalSeatingCheckbox.addEventListener('change', (e) => {
            state.alphabeticalSeating = e.target.checked;
        });
    }

    const evenDistributionCheckbox = document.getElementById('evenDistribution');
    if (evenDistributionCheckbox) {
        evenDistributionCheckbox.addEventListener('change', (e) => {
            state.evenDistribution = e.target.checked;
        });
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
            const originalText = saveSeatingBtn.textContent;
            saveSeatingBtn.textContent = '✓';
            saveSeatingBtn.style.backgroundColor = 'var(--success, #10b981)';
            saveSeatingBtn.style.borderColor = 'var(--success, #10b981)';
            saveSeatingBtn.style.color = 'white';
            setTimeout(() => {
                saveSeatingBtn.textContent = originalText;
                saveSeatingBtn.style.backgroundColor = '';
                saveSeatingBtn.style.borderColor = '';
                saveSeatingBtn.style.color = '';
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

    const buyCoffeeBtn = document.getElementById('buyCoffeeBtn');
    if (buyCoffeeBtn) {
        buyCoffeeBtn.addEventListener('click', () => {
            window.open('https://www.buymeacoffee.com/', '_blank');
        });
    }

    setInterval(() => {
        if (state.currentClass && state.tables.length > 0) {
            saveSeatingPlan();
        }
    }, 60000);

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
                const textNames = textarea.value.split(/\r?\n/).filter(n => n.trim().length > 0).map(n => n.trim());
                textNames.forEach(name => addStudent(name));
                
                if (fileInput.files[0]) {
                    const file = fileInput.files[0];
                    const text = await file.text();
                    
                    if (file.name.toLowerCase().endsWith('.csv')) {
                        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
                        lines.forEach(line => {
                            const columns = line.split(',').map(col => col.trim());
                            if (columns.length >= 2) {
                                const name = `${columns[0]} ${columns[1]}`;
                                if (name.trim().length > 0) addStudent(name);
                            } else if (columns.length === 1 && columns[0].trim().length > 0) {
                                addStudent(columns[0]);
                            }
                        });
                    } else {
                        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
                        lines.forEach(line => {
                            const name = line.trim();
                            if (name && name.length > 0) addStudent(name);
                        });
                    }
                }
                
                closeModal();
            });
            
            textarea.focus();
        });
    }
}