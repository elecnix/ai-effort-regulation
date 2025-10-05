class ThoughtManager {
  private thoughts: string[] = [];
  private maxThoughts = 5;

  addThought(thought: string): void {
    if (this.thoughts.length >= this.maxThoughts) {
      this.thoughts.shift(); // Remove oldest
    }
    this.thoughts.push(thought);
  }

  getConcatenatedThoughts(): string {
    return "(think) " + this.thoughts.map(t => `\n${t}`).join('\n');
  }

  hasThoughts(): boolean {
    return this.thoughts.length > 0;
  }

  clearThoughts(): void {
    this.thoughts = [];
  }
}

export { ThoughtManager };
