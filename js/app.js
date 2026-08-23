import { Database } from './db.js';
import { Parser } from './parser.js';
import { GraphRenderer } from './graph.js';

class NexusApp {
    constructor() {
        this.db = new Database();
        this.parser = new Parser(this.db);
        this.graph = new GraphRenderer('graph-canvas');
        
        this.currentNote = null;
        this.allNotes = [];
        
        // DOM Elements
        this.ui = {
            noteList: document.getElementById('note-list'),
            searchInput: document.getElementById('search-input'),
            btnNewNote: document.getElementById('btn-new-note'),
            
            noteTitle: document.getElementById('note-title'),
            noteContent: document.getElementById('note-content'),
            notePreview: document.getElementById('note-preview'),
            backlinksList: document.getElementById('backlinks-list'),
            
            btnDelete: document.getElementById('btn-delete-note'),
            btnToggleGraph: document.getElementById('btn-toggle-graph'),
            btnCloseGraph: document.getElementById('btn-close-graph'),
            
            editorView: document.getElementById('editor-view'),
            graphView: document.getElementById('graph-view')
        };

        this.init();
    }

    async init() {
        await this.db.init();
        this.allNotes = await this.db.getAllNotes();
        
        if (this.allNotes.length === 0) {
            // Create a default welcome note
            await this.saveNote('Welcome to Nexus', 'This is your new local Second Brain.\n\nYou can create links between notes by using double brackets, like this: [[Ideas]]. Try clicking it!');
        } else {
            this.renderNoteList();
            this.loadNote(this.allNotes[0].title);
        }

        this.setupEventListeners();
        
        // Setup graph click handler
        this.graph.onNodeClick = (nodeId) => {
            this.showEditor();
            this.loadNote(nodeId);
        };
    }

    setupEventListeners() {
        // Save on type (debounce could be added for production)
        this.ui.noteContent.addEventListener('input', () => this.handleTyping());
        
        // Handle title change (requires saving new and deleting old)
        this.ui.noteTitle.addEventListener('change', async (e) => {
            const newTitle = e.target.value.trim();
            if (newTitle && this.currentNote && newTitle !== this.currentNote.title) {
                // Check if exists
                const exists = await this.db.getNote(newTitle);
                if (!exists) {
                    await this.db.deleteNote(this.currentNote.title);
                    this.currentNote.title = newTitle;
                    await this.saveCurrentNote();
                } else {
                    alert("A note with this title already exists.");
                    e.target.value = this.currentNote.title;
                }
            }
        });

        this.ui.btnNewNote.addEventListener('click', () => {
            this.showEditor();
            this.loadNote('Untitled Note ' + Date.now().toString().slice(-4));
        });

        this.ui.btnDelete.addEventListener('click', async () => {
            if (this.currentNote && confirm(`Delete "${this.currentNote.title}"?`)) {
                await this.db.deleteNote(this.currentNote.title);
                this.allNotes = await this.db.getAllNotes();
                this.renderNoteList();
                if (this.allNotes.length > 0) {
                    this.loadNote(this.allNotes[0].title);
                } else {
                    this.loadNote('Welcome to Nexus');
                }
            }
        });

        // Search
        this.ui.searchInput.addEventListener('input', (e) => {
            this.renderNoteList(e.target.value);
        });

        // Intercept clicks on internal links in preview
        this.ui.notePreview.addEventListener('click', (e) => {
            if (e.target.classList.contains('internal-link')) {
                e.preventDefault();
                const targetTitle = e.target.getAttribute('data-target');
                this.loadNote(targetTitle);
            }
        });

        // Intercept clicks on backlinks
        this.ui.backlinksList.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                e.preventDefault();
                this.loadNote(e.target.getAttribute('data-target'));
            }
        });

        // View Toggling
        this.ui.btnToggleGraph.addEventListener('click', async () => {
            this.showGraph();
        });

        this.ui.btnCloseGraph.addEventListener('click', () => {
            this.showEditor();
        });
    }

    async handleTyping() {
        if (!this.currentNote) return;
        this.currentNote.content = this.ui.noteContent.value;
        this.updatePreview();
        await this.saveCurrentNote();
    }

    async saveCurrentNote() {
        await this.db.saveNote(this.currentNote);
        this.allNotes = await this.db.getAllNotes();
        this.renderNoteList(this.ui.searchInput.value);
    }

    async saveNote(title, content) {
        const note = { title, content };
        await this.db.saveNote(note);
        this.allNotes = await this.db.getAllNotes();
        this.renderNoteList();
        this.loadNote(title);
    }

    async loadNote(title) {
        let note = await this.db.getNote(title);
        if (!note) {
            // Auto-create if it doesn't exist (e.g. clicking a dead link)
            note = { title: title, content: '' };
            await this.db.saveNote(note);
            this.allNotes = await this.db.getAllNotes();
            this.renderNoteList(this.ui.searchInput.value);
        }
        
        this.currentNote = note;
        this.ui.noteTitle.value = note.title;
        this.ui.noteContent.value = note.content || '';
        
        this.updatePreview();
        this.updateBacklinks();
        
        // Highlight in list
        document.querySelectorAll('#note-list li').forEach(li => {
            li.classList.toggle('active', li.textContent === title);
        });
    }

    updatePreview() {
        if (!this.currentNote) return;
        const html = this.parser.parse(this.currentNote.content);
        this.ui.notePreview.innerHTML = html;

        // Decorate unresolved links
        const existingTitles = new Set(this.allNotes.map(n => n.title));
        this.ui.notePreview.querySelectorAll('.internal-link').forEach(link => {
            if (!existingTitles.has(link.getAttribute('data-target'))) {
                link.classList.add('unresolved');
            }
        });
    }

    updateBacklinks() {
        if (!this.currentNote) return;
        
        const title = this.currentNote.title;
        const backlinks = this.allNotes.filter(n => {
            if (n.title === title) return false;
            const links = this.parser.extractLinks(n.content || '');
            return links.includes(title);
        });

        if (backlinks.length === 0) {
            this.ui.backlinksList.innerHTML = '<li><span style="color:#666;font-style:italic">No linked mentions</span></li>';
        } else {
            this.ui.backlinksList.innerHTML = backlinks.map(b => 
                `<li><a href="#" data-target="${b.title}">${b.title}</a></li>`
            ).join('');
        }
    }

    renderNoteList(filter = '') {
        const filtered = this.allNotes.filter(n => 
            n.title.toLowerCase().includes(filter.toLowerCase()) || 
            (n.content && n.content.toLowerCase().includes(filter.toLowerCase()))
        );

        // Sort by updated time descending
        filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        this.ui.noteList.innerHTML = filtered.map(n => 
            `<li class="${this.currentNote && n.title === this.currentNote.title ? 'active' : ''}">${n.title}</li>`
        ).join('');

        // Attach clicks
        this.ui.noteList.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => this.loadNote(li.textContent));
        });
    }

    async showGraph() {
        this.ui.editorView.classList.remove('view-active');
        this.ui.graphView.classList.add('view-active');
        
        const graphData = await this.parser.buildGraphData();
        this.graph.setData(graphData);
        this.graph.start();
    }

    showEditor() {
        this.ui.graphView.classList.remove('view-active');
        this.ui.editorView.classList.add('view-active');
        this.graph.stop();
    }
}

// Boot
window.onload = () => {
    new NexusApp();
};
