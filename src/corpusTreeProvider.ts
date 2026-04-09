import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  parseAuthorIndex,
  parseTextIndex,
  AuthorMetadata,
  TextMetadata,
} from "./parseIndex.js";

export interface AuthorItem {
  type: "author";
  dirName: string;
  dirPath: string;
  metadata: AuthorMetadata;
}

export interface WorkItem {
  type: "work";
  filePath: string;
  metadata: TextMetadata;
}

export type CorpusItem = AuthorItem | WorkItem;

export class CorpusTreeProvider
  implements vscode.TreeDataProvider<CorpusItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    CorpusItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private filter = "";

  constructor(private corpusPath: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setCorpusPath(corpusPath: string): void {
    this.corpusPath = corpusPath;
    this.refresh();
  }

  setFilter(filter: string): void {
    this.filter = filter.toLowerCase();
    this.refresh();
  }

  getTreeItem(element: CorpusItem): vscode.TreeItem {
    if (element.type === "author") {
      const label = `${element.metadata.forename} ${element.metadata.surname}`;
      const item = new vscode.TreeItem(
        label,
        this.filter
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
      );
      item.description = `${element.metadata.birth}\u2013${element.metadata.death}`;
      item.contextValue = "author";
      item.iconPath = new vscode.ThemeIcon("person");
      return item;
    } else {
      const item = new vscode.TreeItem(
        element.metadata.title || element.metadata.breadcrumb,
        vscode.TreeItemCollapsibleState.None
      );
      item.contextValue = "work";
      item.iconPath = new vscode.ThemeIcon("book");
      item.command = {
        command: "vscode.open",
        title: "Open Text",
        arguments: [vscode.Uri.file(element.filePath)],
      };
      return item;
    }
  }

  async getChildren(element?: CorpusItem): Promise<CorpusItem[]> {
    if (!this.corpusPath) {
      return [];
    }

    const dataPath = path.join(this.corpusPath, "data");

    if (!element) {
      return this.getAuthors(dataPath);
    }

    if (element.type === "author") {
      return this.getWorks(element);
    }

    return [];
  }

  private async getAuthors(dataPath: string): Promise<AuthorItem[]> {
    try {
      const entries = await fs.promises.readdir(dataPath, {
        withFileTypes: true,
      });
      const authors: AuthorItem[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const indexPath = path.join(dataPath, entry.name, "index.mit");
        const metadata = await parseAuthorIndex(indexPath);
        if (metadata) {
          authors.push({
            type: "author",
            dirName: entry.name,
            dirPath: path.join(dataPath, entry.name),
            metadata,
          });
        }
      }

      let filtered = authors;
      if (this.filter) {
        const allWorks = await Promise.all(
          authors.map((a) => this.loadWorks(a))
        );
        filtered = authors.filter((author, i) => {
          const authorName =
            `${author.metadata.forename} ${author.metadata.surname}`.toLowerCase();
          if (authorName.includes(this.filter)) {
            return true;
          }
          return allWorks[i].some((w) =>
            (w.metadata.title || w.metadata.breadcrumb)
              .toLowerCase()
              .includes(this.filter)
          );
        });
      }

      return filtered.sort((a, b) =>
        a.metadata.surname.localeCompare(b.metadata.surname)
      );
    } catch {
      return [];
    }
  }

  private async getWorks(author: AuthorItem): Promise<WorkItem[]> {
    const works = await this.loadWorks(author);
    if (!this.filter) {
      return works;
    }
    const authorName =
      `${author.metadata.forename} ${author.metadata.surname}`.toLowerCase();
    if (authorName.includes(this.filter)) {
      return works;
    }
    return works.filter((w) =>
      (w.metadata.title || w.metadata.breadcrumb)
        .toLowerCase()
        .includes(this.filter)
    );
  }

  private async loadWorks(author: AuthorItem): Promise<WorkItem[]> {
    try {
      const entries = await fs.promises.readdir(author.dirPath, {
        withFileTypes: true,
      });
      const works: WorkItem[] = [];

      for (const entry of entries) {
        let indexPath: string;

        if (
          entry.isFile() &&
          entry.name.endsWith(".mit") &&
          entry.name !== "index.mit"
        ) {
          // Single-file work (e.g. astell/cr.mit)
          indexPath = path.join(author.dirPath, entry.name);
        } else if (entry.isDirectory()) {
          // Multi-file work with index.mit
          indexPath = path.join(author.dirPath, entry.name, "index.mit");
          try {
            await fs.promises.access(indexPath);
          } catch {
            continue;
          }
        } else {
          continue;
        }

        const metadata = await parseTextIndex(indexPath);
        if (metadata) {
          works.push({ type: "work", filePath: indexPath, metadata });
        }
      }

      return works.sort((a, b) =>
        (a.metadata.title || "").localeCompare(b.metadata.title || "")
      );
    } catch {
      return [];
    }
  }
}
