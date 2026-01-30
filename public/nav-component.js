// Navigation Component - Shared across all pages
class NavMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  isActive(path) {
    const current = window.location.pathname;
    if (path === '/dashboard' && current === '/') return 'active';
    return current === path ? 'active' : '';
  }

  connectedCallback() {
    const currentPath = window.location.pathname;

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      <style>
        :host {
          display: block;
          width: 100%;
        }
        
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          display: inline-block;
          line-height: 1;
          text-transform: none;
          letter-spacing: normal;
          word-wrap: normal;
          white-space: nowrap;
          direction: ltr;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
          -moz-osx-font-smoothing: grayscale;
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }

        nav {
          background: var(--surface-container-lowest);
          border-bottom: 1px solid var(--outline-variant);
          padding: 0 2rem;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
        }
        
        .nav-container {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
        }
        
        .nav-brand {
          font-size: 1.25rem;
          font-weight: 700;
          background: linear-gradient(135deg, #374151, #111827); /* Gray 700 - 900 */
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .nav-links {
          display: flex;
          gap: 0.25rem;
        }
        
        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.75rem;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          transition: all 0.3s ease;
        }
        
        .nav-link:hover {
          color: var(--on-surface);
          background: var(--surface-container-high);
        }
        
        .nav-link.active {
          color: var(--text-primary);
          background: var(--surface-container-highest);
          border: 1px solid var(--outline-variant);
        }
        
        .nav-icon {
          font-size: 1.2rem;
          display: flex;
          align-items: center;
        }
        
        @media (max-width: 900px) {
          nav {
            padding: 0 0.5rem;
          }
          
          .nav-links {
            gap: 0.1rem;
          }
          
          .nav-link {
            padding: 0.4rem 0.5rem;
            font-size: 0.75rem;
          }
          
          .nav-link span:not(.nav-icon) {
            display: none;
          }
          
          .nav-icon {
            font-size: 1.2rem;
          }
        }
      </style>
      
      <nav>
        <div class="nav-container">
          <a href="/dashboard" class="nav-brand">
            <span class="material-symbols-outlined">smart_toy</span>
            Your AI Employee
          </a>
          <div class="nav-links">
            <a href="/dashboard" class="nav-link ${this.isActive('/dashboard')}">
              <span class="nav-icon material-symbols-outlined">dashboard</span>
              <span>Dashboard</span>
            </a>
            <a href="/inspirations.html" class="nav-link ${this.isActive('/inspirations.html')}">
                <span class="material-symbols-outlined">lightbulb</span>
                <span>Online Inspirations</span>
            </a>
            <a href="/ideas" class="nav-link ${this.isActive('/ideas')}">
              <span class="nav-icon material-symbols-outlined">lightbulb</span>
              <span>Design Ideas</span>
            </a>
            <a href="/gallery" class="nav-link ${this.isActive('/gallery')}">
              <span class="nav-icon material-symbols-outlined">photo_library</span>
              <span>Gallery</span>
            </a>
            <a href="/confirm" class="nav-link ${currentPath === '/confirm' ? 'active' : ''}">
              <span class="nav-icon material-symbols-outlined">send</span>
              <span>Send Email</span>
            </a>
          </div>
        </div>
      </nav>
    `;
  }
}

customElements.define('nav-menu', NavMenu);
