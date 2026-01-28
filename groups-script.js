// Groups & Wheel Application - Syncs with main seating app

function menuSelectTab(tab) {
    switchTab(tab);
    
    // Update toolbar active state
    const toolbarItems = document.querySelectorAll('.toolbar-item:not(.export-seating-only)');
    toolbarItems.forEach((btn, index) => {
        btn.classList.remove('active');
        if ((tab === 'seating-plan' && index === 0) || (tab === 'groups-wheel' && index === 1)) {
            btn.classList.add('active');
        }
    });
    
    // Gray out export buttons if not on seating plan tab
    const exportBtns = document.querySelectorAll('.export-seating-only');
    if (tab === 'seating-plan') {
        exportBtns.forEach(btn => btn.classList.remove('disabled'));
    } else {
        exportBtns.forEach(btn => btn.classList.add('disabled'));
    }
}

// Function to switch tabs
window.switchTab = function(tab, button) {
    // Update toolbar buttons active state
    const navButtons = document.querySelectorAll('.toolbar-item:not(.export-seating-only)');
    navButtons.forEach(item => {
        item.classList.remove('active');
    });
    // Mark the clicked toolbar button as active
    if (tab === 'seating-plan' && navButtons[0]) {
        navButtons[0].classList.add('active');
    } else if (tab === 'groups-wheel' && navButtons[1]) {
        navButtons[1].classList.add('active');
    }

    // Hide all content
    document.getElementById('seating-plan-tab').classList.remove('active');
    document.getElementById('groups-wheel-tab').classList.remove('active');
    
    // Show selected content
    if (tab === 'seating-plan') {
        document.getElementById('seating-plan-tab').classList.add('active');
    } else if (tab === 'groups-wheel') {
        document.getElementById('groups-wheel-tab').classList.add('active');
        // Always reload classes when switching to groups/wheel tab
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
    selectedStudent: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    
    // Mark first toolbar button (seating-plan) as active by default
    const toolbarItems = document.querySelectorAll('.toolbar-item:not(.export-seating-only)');
    if (toolbarItems.length > 0) {
        toolbarItems[0].classList.add('active');
    }
    
    // Disable export buttons by default (we start on seating-plan, so they should be enabled)
    const exportBtns = document.querySelectorAll('.export-seating-only');
    exportBtns.forEach(btn => btn.classList.remove('disabled'));
    
    // Load classes after a slight delay to ensure DOM is ready
    setTimeout(() => {
        loadClasses();
    }, 300);
    
    // Listen for storage changes from other tabs/instances
    window.addEventListener('storage', (e) => {
        if (e.key === 'seatingAppClasses') {
            console.log('Detected storage change in seatingAppClasses');
            loadClasses();
        }
    });
});

// Setup all event listeners
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
}

// Load classes from localStorage
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
            
            // Verify class structure
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
                // Store the ID as a string to ensure consistency
                option.value = String(cls.id);
                option.textContent = `${cls.name} (${cls.students ? cls.students.length : 0} students)`;
                select.appendChild(option);
                console.log('Option value set to:', option.value);
            });
        }

        // Clear previous selection
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

// Handle class selection
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

    // Debug: Show all available classes and their IDs
    console.log('Available classes:');
    groupsState.classes.forEach((cls, idx) => {
        console.log(`  [${idx}] ID: ${cls.id} (type: ${typeof cls.id}), Name: ${cls.name}`);
    });
    
    // Try finding by exact match
    let foundClass = groupsState.classes.find(c => c.id === classId);
    
    // If not found, try string comparison (in case of type mismatch)
    if (!foundClass) {
        console.log('Exact match failed, trying string conversion...');
        foundClass = groupsState.classes.find(c => String(c.id) === String(classId));
    }
    
    // If still not found, try numeric comparison
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
        // Don't show alert, just log the error
        updateStudentsList();
    }
}

// Update students list display
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
        return;
    }

    console.log('Displaying', groupsState.students.length, 'students');
    studentsList.innerHTML = groupsState.students.map(student => `
        <div class="student-item-groups">${student.name}</div>
    `).join('');
}

// Show create groups panel
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

// Show spin wheel panel
function showSpinWheelPanel() {
    if (!groupsState.currentClass || groupsState.students.length === 0) {
        alert('Please select a class with students first');
        return;
    }

    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('createGroupsPanel').style.display = 'none';
    document.getElementById('spinWheelPanel').style.display = 'block';
    document.getElementById('wheelResult').style.display = 'none';
    
    // Draw wheel on canvas
    setTimeout(() => {
        drawWheel();
    }, 100);
}

// Hide all panels
function hidePanel() {
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('createGroupsPanel').style.display = 'none';
    document.getElementById('spinWheelPanel').style.display = 'none';
}

// Generate groups
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

    // Shuffle students
    const shuffled = [...groupsState.students].sort(() => Math.random() - 0.5);
    
    // Create groups
    groupsState.groups = [];
    for (let i = 0; i < shuffled.length; i += groupSize) {
        const group = shuffled.slice(i, i + groupSize);
        groupsState.groups.push(group);
    }

    displayGroups();
}

// Display groups
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

// Drag and drop handlers
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
    
    // If dropping in the same group, no action needed
    if (sourceGroupIndex === targetGroupIndex) {
        draggedElement.style.opacity = '1';
        return;
    }
    
    // Move student from source group to target group
    if (sourceGroupIndex < groupsState.groups.length && 
        sourceStudentIndex < groupsState.groups[sourceGroupIndex].length &&
        targetGroupIndex < groupsState.groups.length) {
        
        const student = groupsState.groups[sourceGroupIndex][sourceStudentIndex];
        groupsState.groups[sourceGroupIndex].splice(sourceStudentIndex, 1);
        groupsState.groups[targetGroupIndex].push(student);
        
        displayGroups();
    }
}

// Export groups as text
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

    // Copy to clipboard
    navigator.clipboard.writeText(exportText).then(() => {
        alert('Groups copied to clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
        // Fallback: create a text area
        const textarea = document.createElement('textarea');
        textarea.value = exportText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Groups copied to clipboard!');
    });
}

// Draw wheel on canvas
function drawWheel() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) {
        console.error('wheelCanvas element not found');
        return;
    }

    const ctx = canvas.getContext('2d');
    // Make wheel smaller and more responsive to screen size
    const maxSize = Math.min(350, window.innerWidth - 400, window.innerHeight - 300);
    const size = Math.max(200, maxSize);
    
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;

    // Clear canvas with transparent background
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

    // Draw slices
    groupsState.wheelStudents.forEach((student, index) => {
        const angle = groupsState.wheelAngle + index * sliceAngle;

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, angle, angle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index];
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
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

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pointer (top)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(centerX - 15, 0);
    ctx.lineTo(centerX + 15, 0);
    ctx.lineTo(centerX, 25);
    ctx.closePath();
    ctx.fill();
}

// Generate colors for wheel
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

// Spin wheel function
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

    // Calculate spin
    const sliceAngle = (Math.PI * 2) / groupsState.wheelStudents.length;
    const spins = 5 + Math.random() * 5; // 5-10 full rotations
    
    // Pick a random student
    const randomSlice = Math.floor(Math.random() * groupsState.wheelStudents.length);
    
    // The pointer is at the top (angle 3π/2 in canvas coords where 0 is right, π/2 is down)
    // We want the MIDDLE of the selected slice to align with the pointer
    // So: wheelAngle + randomSlice * sliceAngle + sliceAngle/2 = 3π/2
    // Therefore: targetAngle = 3π/2 - randomSlice * sliceAngle - sliceAngle/2
    const pointerAngle = 3 * Math.PI / 2; // Top of canvas
    const targetAngle = pointerAngle - (randomSlice * sliceAngle + sliceAngle / 2);
    const finalAngle = spins * Math.PI * 2 + targetAngle;

    // Animate spin
    const duration = 3000; // 3 seconds
    const startTime = Date.now();
    const startAngle = groupsState.wheelAngle;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        groupsState.wheelAngle = startAngle + (finalAngle * easeProgress);
        drawWheel();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Animation complete
            groupsState.isSpinning = false;
            spinBtn.disabled = false;
            spinBtn.textContent = originalText;

            // Determine which student is at the pointer
            // The pointer is at 3π/2 (270 degrees)
            const pointerAngle = 3 * Math.PI / 2;
            
            // Normalize wheel angle to 0-2π range
            let normalizedWheelAngle = groupsState.wheelAngle % (Math.PI * 2);
            if (normalizedWheelAngle < 0) normalizedWheelAngle += Math.PI * 2;
            
            // Find which slice is under the pointer
            let studentAtPointer = 0;
            const sliceAngle = (Math.PI * 2) / groupsState.wheelStudents.length;
            
            for (let i = 0; i < groupsState.wheelStudents.length; i++) {
                // Start and end angle of this slice
                let sliceStart = normalizedWheelAngle + i * sliceAngle;
                let sliceEnd = sliceStart + sliceAngle;
                
                // Normalize slice angles to 0-2π
                sliceStart = sliceStart % (Math.PI * 2);
                sliceEnd = sliceEnd % (Math.PI * 2);
                
                // Check if pointer angle falls within this slice
                let isInSlice = false;
                if (sliceStart <= sliceEnd) {
                    isInSlice = pointerAngle >= sliceStart && pointerAngle < sliceEnd;
                } else {
                    // Slice wraps around 0
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
