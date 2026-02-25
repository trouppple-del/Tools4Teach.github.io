function menuSelectTab(tab) {
    switchTab(tab);
    const toolbarItems = document.querySelectorAll('.toolbar-item:not(.export-seating-only)');
    toolbarItems.forEach(btn => btn.classList.remove('active'));
    if (tab === 'seating-plan' && toolbarItems[1]) {
        toolbarItems[1].classList.add('active');
    } else if (tab === 'groups-wheel' && toolbarItems[2]) {
        toolbarItems[2].classList.add('active');
    }
    const exportBtns = document.querySelectorAll('.export-seating-only');
    if (tab === 'seating-plan') {
        exportBtns.forEach(btn => btn.classList.remove('disabled'));
    } else {
        exportBtns.forEach(btn => btn.classList.add('disabled'));
    }
}
window.switchTab = function(tab, button) {
    const navButtons = document.querySelectorAll('.toolbar-item:not(.export-seating-only)');
    navButtons.forEach(item => {
        item.classList.remove('active');
    });
    if (tab === 'seating-plan' && navButtons[1]) {
        navButtons[1].classList.add('active');
    } else if (tab === 'groups-wheel' && navButtons[2]) {
        navButtons[2].classList.add('active');
    }
    document.getElementById('seating-plan-tab').classList.remove('active');
    document.getElementById('groups-wheel-tab').classList.remove('active');
    if (tab === 'seating-plan') {
        document.getElementById('seating-plan-tab').classList.add('active');
    } else if (tab === 'groups-wheel') {
        document.getElementById('groups-wheel-tab').classList.add('active');
        setTimeout(() => {
            loadClasses();
            if (document.getElementById('spinWheelPanel').style.display !== 'none') {
                drawWheel();
            }
        }, 100);
    }
};
const groupsState = {
    classes: [],
    currentClass: null,
    students: [],
    groups: [],
    wheelStudents: [],
    wheelAngle: 0,
    isSpinning: false,
    selectedStudent: null,
    applyConstraintsToGroups: false,
    constraints: []
};
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    const toolbarItems = document.querySelectorAll('.toolbar-item:not(.export-seating-only)');
    if (toolbarItems.length > 1) {
        toolbarItems[1].classList.add('active');
    }
    const exportBtns = document.querySelectorAll('.export-seating-only');
    exportBtns.forEach(btn => btn.classList.remove('disabled'));
    setTimeout(() => {
        loadClasses();
    }, 300);
    window.addEventListener('storage', (e) => {
        if (e.key === 'seatingAppClasses') {
            console.log('Detected storage change in seatingAppClasses');
            loadClasses();
        }
    });
});
function setupEventListeners() {
    const classSelect = document.getElementById('classSelect');
    const refreshClassesBtn = document.getElementById('refreshClassesBtn');
    const createGroupsBtn = document.getElementById('createGroupsBtn');
    const spinWheelBtn = document.getElementById('spinWheelBtn');
    const applyGroupSizeBtn = document.getElementById('applyGroupSizeBtn');
    const regenerateGroupsBtn = document.getElementById('regenerateGroupsBtn');
    const exportGroupsBtn = document.getElementById('exportGroupsBtn');
    const backFromGroupsBtn = document.getElementById('backFromGroupsBtn');
    const spinBtn = document.getElementById('spinBtn');
    const spinAgainBtn = document.getElementById('spinAgainBtn');
    const backFromWheelBtn = document.getElementById('backFromWheelBtn');
    const removeFromWheelBtn = document.getElementById('removeFromWheelBtn');
    if (classSelect) classSelect.addEventListener('change', handleClassSelect);
    if (refreshClassesBtn) refreshClassesBtn.addEventListener('click', loadClasses);
    if (createGroupsBtn) createGroupsBtn.addEventListener('click', showCreateGroupsPanel);
    if (spinWheelBtn) spinWheelBtn.addEventListener('click', showSpinWheelPanel);
    if (applyGroupSizeBtn) applyGroupSizeBtn.addEventListener('click', generateGroups);
    if (regenerateGroupsBtn) regenerateGroupsBtn.addEventListener('click', generateGroups);
    if (exportGroupsBtn) exportGroupsBtn.addEventListener('click', exportGroups);
    if (backFromGroupsBtn) backFromGroupsBtn.addEventListener('click', hidePanel);
    if (spinBtn) spinBtn.addEventListener('click', spinWheel);
    if (spinAgainBtn) spinAgainBtn.addEventListener('click', spinWheel);
    if (backFromWheelBtn) backFromWheelBtn.addEventListener('click', hidePanel);
    if (removeFromWheelBtn) removeFromWheelBtn.addEventListener('click', () => {
        if (groupsState.selectedStudent) {
            const index = groupsState.wheelStudents.findIndex(s => s.id === groupsState.selectedStudent.id);
            if (index !== -1) {
                groupsState.wheelStudents.splice(index, 1);
                drawWheel();
                if (groupsState.wheelStudents.length === 0) {
                    document.getElementById('wheelResult').style.display = 'none';
                }
            }
        }
    });
    const applyConstraintsToGroupsCheckbox = document.getElementById('applyConstraintsToGroups');
    console.log('applyConstraintsToGroupsCheckbox element:', applyConstraintsToGroupsCheckbox);
    if (applyConstraintsToGroupsCheckbox) {
        console.log('Attaching listener to checkbox');
        applyConstraintsToGroupsCheckbox.addEventListener('change', (e) => {
            console.log('Checkbox changed! Checked:', e.target.checked);
            groupsState.applyConstraintsToGroups = e.target.checked;
        });
    } else {
        console.error('applyConstraintsToGroups checkbox not found!');
    }
}
function loadClasses() {
    try {
        console.log('=== LOADING CLASSES ===');
        const stored = localStorage.getItem('seatingAppClasses');
        console.log('Raw stored data:', stored);
        groupsState.classes = [];
        if (stored) {
            groupsState.classes = JSON.parse(stored);
            console.log('Successfully parsed classes:', groupsState.classes);
            console.log('Number of classes:', groupsState.classes.length);
            groupsState.classes.forEach((cls, idx) => {
                console.log(`Class ${idx}:`, {
                    id: cls.id,
                    idType: typeof cls.id,
                    name: cls.name,
                    studentCount: cls.students ? cls.students.length : 0
                });
            });
        } else {
            console.log('No classes found in localStorage - key does not exist');
        }
        try {
            const globalData = localStorage.getItem('seatingAppData');
            if (globalData) {
                const parsed = JSON.parse(globalData);
                groupsState.constraints = parsed.constraints || [];
                console.log('Loaded global constraints from seatingAppData:', groupsState.constraints);
            } else {
                groupsState.constraints = [];
                groupsState.classes.forEach(cls => {
                    if (cls.constraints && Array.isArray(cls.constraints)) {
                        groupsState.constraints.push(...cls.constraints);
                    }
                });
                console.log('No seatingAppData found. Loaded constraints from classes:', groupsState.constraints);
            }
        } catch (e) {
            groupsState.constraints = [];
            console.log('Error loading constraints:', e);
        }
        const select = document.getElementById('classSelect');
        if (!select) {
            console.error('classSelect element not found');
            return;
        }
        select.innerHTML = '<option value="">Select a class...</option>';
        if (groupsState.classes.length === 0) {
            console.warn('No classes to display - showing empty option');
            select.innerHTML += '<option disabled>No classes available - create one in Seating Plan</option>';
        } else {
            groupsState.classes.forEach(cls => {
                console.log('Adding option for class:', {
                    name: cls.name,
                    id: cls.id,
                    idType: typeof cls.id
                });
                const option = document.createElement('option');
                option.value = String(cls.id);
                option.textContent = `${cls.name} (${cls.students ? cls.students.length : 0} students)`;
                select.appendChild(option);
                console.log('Option value set to:', option.value);
            });
        }
        groupsState.currentClass = null;
        groupsState.students = [];
        updateStudentsList();
        console.log('=== LOAD COMPLETE ===');
        console.log('Final dropdown options:', Array.from(select.options).map(o => ({ value: o.value, text: o.text })));
    } catch (e) {
        console.error('Error loading classes:', e);
        console.error('Stack:', e.stack);
        alert('Error loading classes: ' + e.message);
    }
}
function handleClassSelect(e) {
    const classId = e.target.value;
    console.log('=== CLASS SELECTED ===');
    console.log('Selected value:', classId, 'Type:', typeof classId);
    if (!classId) {
        groupsState.currentClass = null;
        groupsState.students = [];
        updateStudentsList();
        return;
    }
    console.log('Available classes:');
    groupsState.classes.forEach((cls, idx) => {
        console.log(`  [${idx}] ID: ${cls.id} (type: ${typeof cls.id}), Name: ${cls.name}`);
    });
    let foundClass = groupsState.classes.find(c => c.id === classId);
    if (!foundClass) {
        console.log('Exact match failed, trying string conversion...');
        foundClass = groupsState.classes.find(c => String(c.id) === String(classId));
    }
    if (!foundClass && !isNaN(classId)) {
        console.log('String match failed, trying numeric conversion...');
        foundClass = groupsState.classes.find(c => Number(c.id) === Number(classId));
    }
    console.log('Found class:', foundClass);
    groupsState.currentClass = foundClass;
    if (groupsState.currentClass) {
        groupsState.students = groupsState.currentClass.students && Array.isArray(groupsState.currentClass.students) 
            ? [...groupsState.currentClass.students] 
            : [];
        groupsState.wheelStudents = [...groupsState.students];
        console.log('Students loaded:', groupsState.students.length);
        updateStudentsList();
    } else {
        console.error('=== CLASS NOT FOUND ===');
        console.error('Selected ID:', classId);
        console.error('Available IDs:', groupsState.classes.map(c => c.id));
        updateStudentsList();
    }
}
function updateStudentsList() {
    const studentsList = document.getElementById('studentsList');
    if (!studentsList) {
        console.error('studentsList element not found');
        return;
    }
    if (groupsState.students.length === 0) {
        let message = 'No students in this class';
        if (!groupsState.currentClass) {
            message = 'Select a class first';
        }
        studentsList.innerHTML = `<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px;">${message}</p>`;
        const constraintsList = document.getElementById('groupsConstraintsList');
        if (constraintsList) {
            updateConstraintsList();
        }
        return;
    }
    console.log('Displaying', groupsState.students.length, 'students');
    studentsList.innerHTML = groupsState.students.map(student => `
        <div class="student-item-groups">${student.name}</div>
    `).join('');
    const constraintsList = document.getElementById('groupsConstraintsList');
    if (constraintsList) {
        updateConstraintsList();
    }
}
function updateConstraintsList() {
    const constraintsList = document.getElementById('groupsConstraintsList');
    console.log('updateConstraintsList called');
    console.log('Current constraints:', groupsState.constraints);
    console.log('Current students:', groupsState.students);
    if (!constraintsList) {
        console.error('groupsConstraintsList element not found');
        return;
    }
    if (!groupsState.currentClass || !groupsState.students || groupsState.students.length === 0) {
        constraintsList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px;">Select a class to see constraints</p>';
        return;
    }
    const currentStudentIds = new Set(groupsState.students.map(s => s.id));
    console.log('Current student IDs:', Array.from(currentStudentIds));
    const applicableConstraints = (groupsState.constraints || []).filter(c =>
        currentStudentIds.has(c.student1) && currentStudentIds.has(c.student2)
    );
    console.log('Applicable constraints:', applicableConstraints);
    if (applicableConstraints.length === 0) {
        constraintsList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px;">No constraints for this class</p>';
        return;
    }
    const together = applicableConstraints.filter(c => c.type === 'together');
    const separate = applicableConstraints.filter(c => c.type === 'separate');
    let html = '';
    if (together.length > 0) {
        html += '<div style="margin-bottom: 10px;"><strong style="font-size: 11px; color: var(--text-muted);">Together (↔️)</strong>';
        html += together.map(c => {
            const student1 = groupsState.students.find(s => s.id === c.student1);
            const student2 = groupsState.students.find(s => s.id === c.student2);
            return `<div style="font-size: 12px; padding: 4px 0; color: var(--text); word-break: break-word;">${student1 ? student1.name : c.student1} ↔️ ${student2 ? student2.name : c.student2}</div>`;
        }).join('');
        html += '</div>';
    }
    if (separate.length > 0) {
        html += '<div style="margin-bottom: 10px;"><strong style="font-size: 11px; color: var(--text-muted);">Separate (⇄)</strong>';
        html += separate.map(c => {
            const student1 = groupsState.students.find(s => s.id === c.student1);
            const student2 = groupsState.students.find(s => s.id === c.student2);
            return `<div style="font-size: 12px; padding: 4px 0; color: var(--text); word-break: break-word;">${student1 ? student1.name : c.student1} ⇄ ${student2 ? student2.name : c.student2}</div>`;
        }).join('');
        html += '</div>';
    }
    constraintsList.innerHTML = html;
}
function showCreateGroupsPanel() {
    if (!groupsState.currentClass || groupsState.students.length === 0) {
        alert('Please select a class with students first');
        return;
    }
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('createGroupsPanel').style.display = 'block';
    document.getElementById('spinWheelPanel').style.display = 'none';
    generateGroups();
}
function showSpinWheelPanel() {
    if (!groupsState.currentClass || groupsState.students.length === 0) {
        alert('Please select a class with students first');
        return;
    }
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('createGroupsPanel').style.display = 'none';
    document.getElementById('spinWheelPanel').style.display = 'block';
    document.getElementById('wheelResult').style.display = 'none';
    setTimeout(() => {
        drawWheel();
    }, 100);
}
function hidePanel() {
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('createGroupsPanel').style.display = 'none';
    document.getElementById('spinWheelPanel').style.display = 'none';
}
function generateGroups() {
    const groupSizeInput = document.getElementById('groupSize');
    if (!groupSizeInput) {
        console.error('groupSize input not found');
        return;
    }
    const groupSize = parseInt(groupSizeInput.value);
    if (isNaN(groupSize) || groupSize < 1) {
        alert('Please enter a valid group size');
        return;
    }
    if (groupSize > groupsState.students.length) {
        alert(`Group size cannot be larger than number of students (${groupsState.students.length})`);
        return;
    }
    let studentsToGroup = [...groupsState.students];
    console.log('generateGroups called');
    console.log('applyConstraintsToGroups:', groupsState.applyConstraintsToGroups);
    console.log('constraints:', groupsState.constraints);
    console.log('constraints length:', groupsState.constraints ? groupsState.constraints.length : 0);
    if (groupsState.applyConstraintsToGroups && groupsState.constraints && groupsState.constraints.length > 0) {
        console.log('APPLYING CONSTRAINTS');
        const currentStudentIds = new Set(groupsState.students.map(s => s.id));
        const togetherConstraints = groupsState.constraints.filter(c => 
            c.type === 'together' && 
            currentStudentIds.has(c.student1) && 
            currentStudentIds.has(c.student2)
        );
        const togetherGroups = [];
        for (const c of togetherConstraints) {
            let g = togetherGroups.find(x => x.includes(c.student1) || x.includes(c.student2));
            if (!g) {
                g = [];
                togetherGroups.push(g);
            }
            if (!g.includes(c.student1)) g.push(c.student1);
            if (!g.includes(c.student2)) g.push(c.student2);
        }
        const placed = new Set();
        const groups = [];
        for (const group of togetherGroups) {
            const members = group
                .map(id => studentsToGroup.find(s => s.id === id))
                .filter(s => s);
            if (members.length > 0) {
                groups.push(members);
                members.forEach(m => placed.add(m.id));
            }
        }
        const remaining = studentsToGroup.filter(s => !placed.has(s.id));
        const separateConstraints = groupsState.constraints.filter(c => 
            c.type === 'separate' && 
            currentStudentIds.has(c.student1) && 
            currentStudentIds.has(c.student2)
        );
        const cannotBeTogether = new Map();
        for (const c of separateConstraints) {
            if (!cannotBeTogether.has(c.student1)) cannotBeTogether.set(c.student1, new Set());
            if (!cannotBeTogether.has(c.student2)) cannotBeTogether.set(c.student2, new Set());
            cannotBeTogether.get(c.student1).add(c.student2);
            cannotBeTogether.get(c.student2).add(c.student1);
        }
        const shuffled = remaining.sort(() => Math.random() - 0.5);
        let i = 0;
        while (i < shuffled.length) {
            let targetGroup = null;
            let smallestSize = groupSize;
            for (const group of groups) {
                if (group.length < groupSize) {
                    let canAdd = true;
                    const student = shuffled[i];
                    const conflicts = cannotBeTogether.get(student.id);
                    if (conflicts) {
                        for (const member of group) {
                            if (conflicts.has(member.id)) {
                                canAdd = false;
                                break;
                            }
                        }
                    }
                    if (canAdd && group.length < smallestSize) {
                        targetGroup = group;
                        smallestSize = group.length;
                    }
                }
            }
            if (targetGroup) {
                targetGroup.push(shuffled[i]);
                i++;
            } else {
                const newGroup = [];
                while (newGroup.length < groupSize && i < shuffled.length) {
                    const student = shuffled[i];
                    let canAdd = true;
                    const conflicts = cannotBeTogether.get(student.id);
                    if (conflicts) {
                        for (const member of newGroup) {
                            if (conflicts.has(member.id)) {
                                canAdd = false;
                                break;
                            }
                        }
                    }
                    if (canAdd) {
                        newGroup.push(student);
                        i++;
                    } else {
                        i++;
                        if (i >= shuffled.length) break;
                    }
                }
                if (newGroup.length > 0) {
                    groups.push(newGroup);
                } else {
                    break; 
                }
            }
        }
        groupsState.groups = groups;
    } else {
        const shuffled = [...groupsState.students].sort(() => Math.random() - 0.5);
        groupsState.groups = [];
        for (let i = 0; i < shuffled.length; i += groupSize) {
            const group = shuffled.slice(i, i + groupSize);
            groupsState.groups.push(group);
        }
    }
    displayGroups();
}
function displayGroups() {
    const groupsDisplay = document.getElementById('groupsDisplay');
    if (!groupsDisplay) {
        console.error('groupsDisplay element not found');
        return;
    }
    if (groupsState.groups.length === 0) {
        groupsDisplay.innerHTML = '<p>No groups created</p>';
        return;
    }
    groupsDisplay.innerHTML = groupsState.groups.map((group, groupIndex) => `
        <div class="group-card" data-group-index="${groupIndex}" ondrop="handleDropStudent(event, ${groupIndex})" ondragover="handleDragOver(event)">
            <div class="group-title">Group ${groupIndex + 1}</div>
            <div class="group-students">
                ${group.map((student, studentIndex) => `
                    <div class="group-student" draggable="true" data-group="${groupIndex}" data-student="${studentIndex}" ondragstart="handleDragStudent(event)" ondragend="handleDragEnd(event)">${student.name}</div>
                `).join('')}
            </div>
        </div>
    `).join('');
}
let draggedElement = null;
let sourceGroupIndex = null;
let sourceStudentIndex = null;
function handleDragStudent(event) {
    draggedElement = event.target;
    sourceGroupIndex = parseInt(event.target.dataset.group);
    sourceStudentIndex = parseInt(event.target.dataset.student);
    event.target.style.opacity = '0.5';
    event.dataTransfer.effectAllowed = 'move';
}
function handleDragEnd(event) {
    draggedElement = null;
    sourceGroupIndex = null;
    sourceStudentIndex = null;
    event.target.style.opacity = '1';
}
function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}
function handleDropStudent(event, targetGroupIndex) {
    event.preventDefault();
    if (sourceGroupIndex === null || sourceStudentIndex === null) return;
    if (sourceGroupIndex === targetGroupIndex) {
        draggedElement.style.opacity = '1';
        return;
    }
    if (sourceGroupIndex < groupsState.groups.length && 
        sourceStudentIndex < groupsState.groups[sourceGroupIndex].length &&
        targetGroupIndex < groupsState.groups.length) {
        const student = groupsState.groups[sourceGroupIndex][sourceStudentIndex];
        groupsState.groups[sourceGroupIndex].splice(sourceStudentIndex, 1);
        groupsState.groups[targetGroupIndex].push(student);
        displayGroups();
    }
}
function exportGroups() {
    if (groupsState.groups.length === 0) {
        alert('No groups to export');
        return;
    }
    let exportText = `${groupsState.currentClass.name} - Groups\n`;
    exportText += `Created: ${new Date().toLocaleString()}\n`;
    exportText += '='.repeat(50) + '\n\n';
    groupsState.groups.forEach((group, index) => {
        exportText += `Group ${index + 1} (${group.length} students):\n`;
        group.forEach(student => {
            exportText += `  - ${student.name}\n`;
        });
        exportText += '\n';
    });
    navigator.clipboard.writeText(exportText).then(() => {
        alert('Groups copied to clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
        const textarea = document.createElement('textarea');
        textarea.value = exportText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Groups copied to clipboard!');
    });
}
function drawWheel() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) {
        console.error('wheelCanvas element not found');
        return;
    }
    const ctx = canvas.getContext('2d');
    const maxSize = Math.min(350, window.innerWidth - 400, window.innerHeight - 300);
    const size = Math.max(200, maxSize);
    canvas.width = size;
    canvas.height = size;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    ctx.clearRect(0, 0, size, size);
    if (groupsState.wheelStudents.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No students to spin', centerX, centerY);
        return;
    }
    const sliceAngle = (Math.PI * 2) / groupsState.wheelStudents.length;
    const colors = generateColors(groupsState.wheelStudents.length);
    groupsState.wheelStudents.forEach((student, index) => {
        const angle = groupsState.wheelAngle + index * sliceAngle;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, angle, angle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index];
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        const textRadius = radius * 0.6;
        const maxLength = 15;
        const name = student.name.substring(0, maxLength);
        ctx.fillText(name, textRadius, 0);
        ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(centerX - 15, 0);
    ctx.lineTo(centerX + 15, 0);
    ctx.lineTo(centerX, 25);
    ctx.closePath();
    ctx.fill();
}
function generateColors(count) {
    const hues = [
        '#3b82f6', '#ef4444', '#1094b9', '#f59e0b',
        '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
        '#f97316', '#6366f1', '#d946ef', '#a16207'
    ];
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(hues[i % hues.length]);
    }
    return colors;
}
function spinWheel() {
    if (groupsState.isSpinning) return;
    if (groupsState.wheelStudents.length === 0) {
        alert('No students to spin');
        return;
    }
    groupsState.isSpinning = true;
    const spinBtn = document.getElementById('spinBtn');
    spinBtn.disabled = true;
    const originalText = spinBtn.textContent;
    spinBtn.textContent = 'Spinning...';
    const sliceAngle = (Math.PI * 2) / groupsState.wheelStudents.length;
    const spins = 5 + Math.random() * 5; 
    const randomSlice = Math.floor(Math.random() * groupsState.wheelStudents.length);
    const pointerAngle = 3 * Math.PI / 2; 
    const targetAngle = pointerAngle - (randomSlice * sliceAngle + sliceAngle / 2);
    const finalAngle = spins * Math.PI * 2 + targetAngle;
    const duration = 3000; 
    const startTime = Date.now();
    const startAngle = groupsState.wheelAngle;
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        groupsState.wheelAngle = startAngle + (finalAngle * easeProgress);
        drawWheel();
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            groupsState.isSpinning = false;
            spinBtn.disabled = false;
            spinBtn.textContent = originalText;
            const pointerAngle = 3 * Math.PI / 2;
            let normalizedWheelAngle = groupsState.wheelAngle % (Math.PI * 2);
            if (normalizedWheelAngle < 0) normalizedWheelAngle += Math.PI * 2;
            let studentAtPointer = 0;
            const sliceAngle = (Math.PI * 2) / groupsState.wheelStudents.length;
            for (let i = 0; i < groupsState.wheelStudents.length; i++) {
                let sliceStart = normalizedWheelAngle + i * sliceAngle;
                let sliceEnd = sliceStart + sliceAngle;
                sliceStart = sliceStart % (Math.PI * 2);
                sliceEnd = sliceEnd % (Math.PI * 2);
                let isInSlice = false;
                if (sliceStart <= sliceEnd) {
                    isInSlice = pointerAngle >= sliceStart && pointerAngle < sliceEnd;
                } else {
                    isInSlice = pointerAngle >= sliceStart || pointerAngle < sliceEnd;
                }
                if (isInSlice) {
                    studentAtPointer = i;
                    break;
                }
            }
            groupsState.selectedStudent = groupsState.wheelStudents[studentAtPointer];
            document.getElementById('selectedStudentName').textContent = groupsState.selectedStudent.name;
            document.getElementById('wheelResult').style.display = 'flex';
        }
    }
    animate();
}
