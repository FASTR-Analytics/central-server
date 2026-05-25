declare module "markdown-it" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class MarkdownIt {
    constructor(options?: Record<string, unknown>);
    render(src: string): string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parse(src: string, env?: unknown): any[];
    use(plugin: unknown, ...params: unknown[]): this;
    [key: string]: unknown;
  }
  export = MarkdownIt;
}
