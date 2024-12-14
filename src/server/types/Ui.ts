export interface ContextMenuOptions {
  x: number;
  y: number;
  items: Array<{
    label: string;
    action: () => void;
  }>;
}

export class ContextMenu {
  private element: HTMLElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "context-menu";
    document.body.appendChild(this.element);
  }

  show(options: ContextMenuOptions): void {
    this.element.style.left = `${options.x}px`;
    this.element.style.top = `${options.y}px`;
    this.element.innerHTML = "";

    options.items.forEach((item) => {
      const menuItem = document.createElement("div");
      menuItem.className = "context-menu-item";
      menuItem.textContent = item.label;
      menuItem.onclick = () => {
        item.action();
        this.hide();
      };
      this.element.appendChild(menuItem);
    });

    this.element.style.display = "block";
  }

  hide(): void {
    this.element.style.display = "none";
  }
}
