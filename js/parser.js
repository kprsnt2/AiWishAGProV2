/**
 * parser.js
 * Extends Marked.js to support [[WikiLinks]] and extracts graph edges.
 */
export class Parser {
    constructor(db) {
        this.db = db;
        // Configure marked to use our custom renderer for wikilinks
        this.setupMarked();
    }

    setupMarked() {
        // Custom tokenizer for [[Link]]
        const wikiLinkRule = /^\[\[(.*?)\]\]/;
        const wikiLinkTokenizer = {
            name: 'wikilink',
            level: 'inline',
            start(src) { return src.match(/\[\[/)?.index; },
            tokenizer(src, tokens) {
                const match = wikiLinkRule.exec(src);
                if (match) {
                    return {
                        type: 'wikilink',
                        raw: match[0],
                        text: match[1].trim()
                    };
                }
            },
            renderer(token) {
                // We will add class 'unresolved' if it doesn't exist, but we do this asynchronously usually.
                // For simplicity in synchronous render, we just output the tag. 
                // The UI layer will decorate it.
                return `<a href="#" class="internal-link" data-target="${token.text}">${token.text}</a>`;
            }
        };

        marked.use({ extensions: [wikiLinkTokenizer] });
    }

    parse(markdown) {
        return marked.parse(markdown);
    }

    extractLinks(markdown) {
        const links = [];
        const regex = /\[\[(.*?)\]\]/g;
        let match;
        while ((match = regex.exec(markdown)) !== null) {
            links.push(match[1].trim());
        }
        return [...new Set(links)]; // Unique links
    }

    // Build the graph representation for visualization
    async buildGraphData() {
        const notes = await this.db.getAllNotes();
        const nodes = [];
        const edges = [];
        
        const existingTitles = new Set(notes.map(n => n.title));

        notes.forEach(note => {
            nodes.push({ id: note.title, exists: true });
            
            const links = this.extractLinks(note.content || '');
            links.forEach(target => {
                edges.push({ source: note.title, target: target });
                // If the target doesn't exist yet, add a "ghost" node
                if (!existingTitles.has(target) && !nodes.find(n => n.id === target)) {
                    nodes.push({ id: target, exists: false });
                }
            });
        });

        return { nodes, edges };
    }
}
