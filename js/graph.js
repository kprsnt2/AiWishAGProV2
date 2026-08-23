/**
 * graph.js
 * Renders a force-directed graph of the notes using HTML5 Canvas.
 */
export class GraphRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.width = 0;
        this.height = 0;
        this.animationId = null;
        
        // Physics constants
        this.repulsion = 2000;
        this.springLength = 100;
        this.springTension = 0.05;
        this.damping = 0.85;

        // Interaction
        this.draggedNode = null;
        this.hoveredNode = null;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInteractions();
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.width = parent.clientWidth;
        this.height = parent.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    setData(data) {
        // Initialize positions randomly if they don't have one
        this.nodes = data.nodes.map(n => ({
            ...n,
            x: n.x || Math.random() * this.width,
            y: n.y || Math.random() * this.height,
            vx: 0,
            vy: 0
        }));

        this.edges = data.edges.map(e => ({
            source: this.nodes.find(n => n.id === e.source),
            target: this.nodes.find(n => n.id === e.target)
        })).filter(e => e.source && e.target);
    }

    start() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        const loop = () => {
            this.step();
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    step() {
        // 1. Repulsion between all nodes
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                let n1 = this.nodes[i];
                let n2 = this.nodes[j];
                
                let dx = n2.x - n1.x;
                let dy = n2.y - n1.y;
                let distSq = dx*dx + dy*dy;
                
                if (distSq > 0) {
                    let force = this.repulsion / distSq;
                    let dist = Math.sqrt(distSq);
                    let fx = (dx / dist) * force;
                    let fy = (dy / dist) * force;
                    
                    n1.vx -= fx;
                    n1.vy -= fy;
                    n2.vx += fx;
                    n2.vy += fy;
                }
            }
        }

        // 2. Spring attraction for edges
        for (let edge of this.edges) {
            let dx = edge.target.x - edge.source.x;
            let dy = edge.target.y - edge.source.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 0) {
                let force = (dist - this.springLength) * this.springTension;
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;
                
                edge.source.vx += fx;
                edge.source.vy += fy;
                edge.target.vx -= fx;
                edge.target.vy -= fy;
            }
        }

        // 3. Center gravity to keep graph on screen
        let cx = this.width / 2;
        let cy = this.height / 2;
        for (let n of this.nodes) {
            n.vx += (cx - n.x) * 0.01;
            n.vy += (cy - n.y) * 0.01;
        }

        // 4. Update positions
        for (let n of this.nodes) {
            if (n === this.draggedNode) continue;
            
            n.x += n.vx;
            n.y += n.vy;
            n.vx *= this.damping;
            n.vy *= this.damping;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw edges
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        for (let edge of this.edges) {
            this.ctx.beginPath();
            this.ctx.moveTo(edge.source.x, edge.source.y);
            this.ctx.lineTo(edge.target.x, edge.target.y);
            this.ctx.stroke();
        }

        // Draw nodes
        for (let n of this.nodes) {
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, 6, 0, Math.PI * 2);
            
            if (n === this.hoveredNode) {
                this.ctx.fillStyle = '#fff';
            } else if (n.exists) {
                this.ctx.fillStyle = '#007acc';
            } else {
                this.ctx.fillStyle = '#858585';
            }
            
            this.ctx.fill();
            this.ctx.strokeStyle = '#1e1e1e';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw labels
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '12px sans-serif';
            this.ctx.fillText(n.id, n.x + 10, n.y + 4);
        }
    }

    setupInteractions() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (this.draggedNode) {
                this.draggedNode.x = x;
                this.draggedNode.y = y;
            } else {
                // Check hover
                this.hoveredNode = this.nodes.find(n => {
                    const dx = n.x - x;
                    const dy = n.y - y;
                    return Math.sqrt(dx*dx + dy*dy) < 10;
                });
                this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'default';
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.hoveredNode) {
                this.draggedNode = this.hoveredNode;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.draggedNode = null;
        });

        this.canvas.addEventListener('click', () => {
            if (this.hoveredNode && this.onNodeClick) {
                this.onNodeClick(this.hoveredNode.id);
            }
        });
    }
}
