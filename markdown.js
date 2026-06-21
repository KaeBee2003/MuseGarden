//  MARKDOWN PARSER
// ════════════════════════════════════════════════════════════════════
function parseMarkdown(text) {
  // Escape HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Fenced code blocks
  html = html.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code.trimEnd()}</code></pre>`);

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) =>
    `<h${hashes.length}>${content}</h${hashes.length}>`);

  // Blockquote
  html = html.replace(/^&gt;\s*(.+)$/gm, "<blockquote>$1</blockquote>");

  // HR
  html = html.replace(/^---+$/gm, "<hr>");

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Todo lists (- [ ] / - [x])
  // Collect todo items into a ul.md-todo
  html = html.replace(/^((?:- \[[ xX]\] .+\n?)+)/gm, block => {
    const items = block.trim().split("\n").map(line => {
      const checked = /- \[[xX]\]/.test(line);
      const content = line.replace(/^- \[[ xX]\] /, "");
      return `<li><input type="checkbox" ${checked ? "checked" : ""} onclick="return false"> ${content}</li>`;
    }).join("");
    return `<ul class="md-todo">${items}</ul>`;
  });

  // Toggle lists: > text (already consumed by blockquote logic above - use special syntax)
  // Use ":: Title\ncontent" for toggles
  html = html.replace(/^::\s*(.+)\n((?:(?!::).+\n?)*)/gm, (_, title, content) =>
    `<details class="md-toggle"><summary>${title}</summary><div class="toggle-content">${content.trim()}</div></details>`);

  // Unordered lists
  html = html.replace(/^((?:[-*+] .+\n?)+)/gm, block => {
    const items = block.trim().split("\n").filter(l => /^[-*+] /.test(l)).map(l =>
      `<li>${l.replace(/^[-*+] /, "")}</li>`).join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/^((?:\d+\. .+\n?)+)/gm, block => {
    const items = block.trim().split("\n").filter(l => /^\d+\. /.test(l)).map(l =>
      `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
    return `<ol>${items}</ol>`;
  });

  // Paragraphs (lines not already in block elements)
  html = html.split("\n").map(line => {
    if (!line.trim()) return "";
    if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|details)/.test(line.trim())) return line;
    return `<p>${line}</p>`;
  }).join("\n");

  return html;
}

function renderMarkdownInNode(descEl, content) {
  const rendered = document.createElement("div");
  rendered.className = "md-view";
  rendered.innerHTML = parseMarkdown(content);
  descEl.innerHTML = "";
  descEl.appendChild(rendered);
  descEl.classList.add("md-rendered");
  descEl.contentEditable = "false";
}

function switchToEditMode(descEl, node) {
  descEl.innerHTML = escHtml(node.content);
  descEl.classList.remove("md-rendered");
  descEl.contentEditable = "true";
  // Place cursor at end
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(descEl);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function showToast(msg, duration = 4000, type = "") {
  const container = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = "toast" + (type ? " " + type : "");
  t.textContent = msg;
  t.onclick = () => t.remove();
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

