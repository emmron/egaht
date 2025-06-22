import { createPlugin, metadata } from '../utils/createPlugin';
import { CompilerHookContext, TransformResult } from '../types';

/**
 * Example Plugin: Custom Template Directive
 * 
 * Adds support for a custom `@tooltip` directive in Eghact templates
 * Usage: <button @tooltip="Click me for action">Submit</button>
 * 
 * This demonstrates:
 * - Compiler hook integration
 * - Template transformation
 * - Custom syntax extension
 */

interface TooltipOptions {
  position?: 'top' | 'bottom' | 'left' | 'right';
  theme?: 'dark' | 'light';
  delay?: number;
}

export const customDirectivePlugin = createPlugin({
  metadata: metadata()
    .name('@eghact/plugin-custom-directive')
    .version('1.0.0')
    .description('Adds custom @tooltip directive support to Eghact templates')
    .author('Agent 3 v2.0')
    .keywords(['eghact-plugin', 'directive', 'tooltip', 'ui'])
    .engines({ eghact: '^1.0.0' })
    .build(),

  compiler: {
    /**
     * Transform template to handle @tooltip directive
     */
    async transformTemplate(template: string, context: CompilerHookContext): Promise<string> {
      const options = context.options as TooltipOptions;
      
      // Find @tooltip directives in template
      const tooltipRegex = /@tooltip=["']([^"']+)["']/g;
      
      let transformedTemplate = template;
      let match;

      while ((match = tooltipRegex.exec(template)) !== null) {
        const [fullMatch, tooltipText] = match;
        
        // Generate unique tooltip ID
        const tooltipId = `tooltip_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create tooltip HTML structure
        const tooltipHTML = `
          data-tooltip="${tooltipText}"
          data-tooltip-id="${tooltipId}"
          onmouseenter="window.__eghact_showTooltip('${tooltipId}', '${tooltipText}', ${JSON.stringify(options)})"
          onmouseleave="window.__eghact_hideTooltip('${tooltipId}')"
        `;
        
        // Replace @tooltip directive with HTML attributes
        transformedTemplate = transformedTemplate.replace(fullMatch, tooltipHTML.trim());
      }

      return transformedTemplate;
    },

    /**
     * Inject tooltip runtime code during build
     */
    async generateBundle(bundle: any): Promise<void> {
      // Inject tooltip runtime JavaScript
      const tooltipRuntime = `
        window.__eghact_showTooltip = function(id, text, options = {}) {
          const tooltip = document.createElement('div');
          tooltip.id = 'eghact-tooltip-' + id;
          tooltip.className = 'eghact-tooltip eghact-tooltip-' + (options.theme || 'dark');
          tooltip.textContent = text;
          tooltip.style.cssText = \`
            position: absolute;
            background: \${options.theme === 'light' ? '#fff' : '#333'};
            color: \${options.theme === 'light' ? '#333' : '#fff'};
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            opacity: 0;
            transition: opacity 0.2s ease;
          \`;
          
          document.body.appendChild(tooltip);
          
          setTimeout(() => {
            tooltip.style.opacity = '1';
          }, options.delay || 100);
          
          // Position tooltip
          const updatePosition = (e) => {
            const rect = e.target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            const position = options.position || 'top';
            
            let x, y;
            switch (position) {
              case 'top':
                x = rect.left + rect.width / 2 - tooltipRect.width / 2;
                y = rect.top - tooltipRect.height - 8;
                break;
              case 'bottom':
                x = rect.left + rect.width / 2 - tooltipRect.width / 2;
                y = rect.bottom + 8;
                break;
              case 'left':
                x = rect.left - tooltipRect.width - 8;
                y = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
              case 'right':
                x = rect.right + 8;
                y = rect.top + rect.height / 2 - tooltipRect.height / 2;
                break;
            }
            
            tooltip.style.left = Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, x)) + 'px';
            tooltip.style.top = Math.max(8, Math.min(window.innerHeight - tooltipRect.height - 8, y)) + 'px';
          };
          
          const targetElement = document.querySelector(\`[data-tooltip-id="\${id}"]\`);
          if (targetElement) {
            updatePosition({ target: targetElement });
          }
        };
        
        window.__eghact_hideTooltip = function(id) {
          const tooltip = document.getElementById('eghact-tooltip-' + id);
          if (tooltip) {
            tooltip.style.opacity = '0';
            setTimeout(() => {
              if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
              }
            }, 200);
          }
        };
      `;

      // Add to bundle
      if (bundle.js) {
        bundle.js += '\n' + tooltipRuntime;
      }
    }
  },

  runtime: {
    /**
     * Clean up tooltips when components unmount
     */
    beforeUnmount(context) {
      // Find and remove any tooltips created by this component
      const tooltips = document.querySelectorAll('.eghact-tooltip');
      tooltips.forEach(tooltip => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });
    }
  },

  async init(pluginManager) {
    console.log('🎯 Custom Directive Plugin initialized - @tooltip directive available');
  },

  async destroy() {
    // Clean up any remaining tooltips
    const tooltips = document.querySelectorAll('.eghact-tooltip');
    tooltips.forEach(tooltip => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    });
    
    // Remove global functions
    delete window.__eghact_showTooltip;
    delete window.__eghact_hideTooltip;
    
    console.log('🎯 Custom Directive Plugin destroyed');
  }
});