import { ErrorInfo } from '@monitor/shared/types';

export class SourceMapParser {
  private cache = new Map<string, any>();

  async parseStackTrace(error: ErrorInfo): Promise<ErrorInfo> {
    if (!error.stack) return error;

    const lines = error.stack.split('\n');
    const mappedLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [, func, file, lineNum, colNum] = match;
        const mapped = await this.mapPosition(file, parseInt(lineNum), parseInt(colNum));
        if (mapped) {
          mappedLines.push(`at ${func} (${mapped.source}:${mapped.line}:${mapped.column})`);
        } else {
          mappedLines.push(line);
        }
      } else {
        mappedLines.push(line);
      }
    }

    return {
      ...error,
      stack: mappedLines.join('\n'),
    };
  }

  private async mapPosition(file: string, line: number, column: number) {
    const mapUrl = `${file}.map`;

    try {
      const sourceMap = await this.fetchSourceMap(mapUrl);
      if (!sourceMap) return null;

      return {
        source: sourceMap.sources?.[0] || file,
        line,
        column,
      };
    } catch {
      return null;
    }
  }

  private async fetchSourceMap(url: string): Promise<any> {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const map = await response.json();
      this.cache.set(url, map);
      return map;
    } catch {
      return null;
    }
  }
}
