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
    return this.thoughts.map(t => `<THOUGHTS>${t}</THOUGHTS>`).join('\n');
  }

  hasThoughts(): boolean {
    return this.thoughts.length > 0;
  }
}

export { ThoughtManager };
