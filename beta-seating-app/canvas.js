const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let resizeTimer;

function resizeCanvas() {
    canvas.width = window.innerWidth - 320;
    canvas.height = window.innerHeight;
    redrawCanvas();
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
    const baseColorLight = baseColor + '1a';
    
    if (table.type === 'square') {
        ctx.fillStyle = isSelected ? baseColor + '4d' : baseColorLight;
        ctx.strokeStyle = isSelected ? baseColor : baseColor;
        ctx.lineWidth = isSelected ? 3 : 2;
        
        const x = (table.x + state.pan.x) * state.scale;
        const y = (table.y + state.pan.y) * state.scale;
        const w = (table.width || 50) * state.scale;
        const h = (table.height || 50) * state.scale;
        
        if (table.rotation && table.rotation !== 0) {
            ctx.translate(x + w/2, y + h/2);
            ctx.rotate(table.rotation);
            ctx.fillRect(-w/2, -h/2, w, h);
            ctx.strokeRect(-w/2, -h/2, w, h);
            
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
            const fontSize = 12;
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
            const fontSize = 12;
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
    const fontSize = textObj.fontSize || 14;
    
    ctx.fillStyle = isSelected ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.8)';
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#d1d5db';
    ctx.lineWidth = isSelected ? 2 : 1;
    
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const metrics = ctx.measureText(textObj.text);
    const width = metrics.width + 8;
    const height = fontSize + 8;
    
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
    
    if (state.lastAction) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, canvas.height - 40, 150, 35);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(state.lastAction, 15, canvas.height - 18);
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(canvas.width - 60, canvas.height - 25, 55, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`v${APP_VERSION}`, canvas.width - 32, canvas.height - 12);
}