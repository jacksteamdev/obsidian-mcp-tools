# Add Security Information to Installation UI

## Context
The MCP server binary is now published with GitHub artifact attestations, providing cryptographic proof of where and how the binaries were built. We need to inform users about this security feature and how to verify binaries.

## Requirements

### UI Changes to McpServerInstallSettings.svelte

1. Add an info message box in the Resources section:
   - Should appear at the top of the Resources section
   - Must preserve all existing Resources section content
   - Should use Obsidian's theming variables for styling

2. Info Message Content:
   ```html
   <div class="info-message">
     <p>
       The MCP server binary includes GitHub artifact attestations for security verification.
       <a
         href="https://github.com/jacksteamdev/obsidian-advanced-mcp-server#binary-verification"
         target="_blank"
         rel="noopener"
       >
         Learn how to verify →
       </a>
     </p>
   </div>
   ```

3. Add CSS styles:
   ```css
   .info-message {
     background: var(--background-secondary);
     border-radius: 4px;
     padding: 1em;
     margin-bottom: 1em;
   }

   .info-message p {
     margin: 0;
   }
   ```

### Implementation Notes

1. The changes must be made without disrupting existing functionality:
   - Preserve all current UI elements and their behavior
   - Maintain existing styles
   - Keep all current imports and script logic

2. The info message should be:
   - Visually distinct but not overpowering
   - Consistent with Obsidian's design language
   - Accessible and readable

3. The link should:
   - Open in a new tab (target="_blank")
   - Include security attributes (rel="noopener")
   - Point to the binary verification section in README.md

## Related Changes
- GitHub workflow now includes artifact attestation generation
- README.md includes binary verification documentation
- This change completes the security enhancement feature
