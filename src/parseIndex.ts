import { compile } from "@earlytexts/markit";
import * as fs from "fs";

export type AuthorMetadata = {
  forename: string;
  surname: string;
  title?: string;
  birth: number;
  death: number;
  published: number;
  nationality: string;
  sex: "Male" | "Female";
};

export type TextMetadata = {
  imported: boolean;
  title: string;
  breadcrumb: string;
  published: number[];
  copytext: string[];
  sourceDesc?: string;
  editions?: string[];
  children?: string[];
};

export async function parseAuthorIndex(
  filePath: string
): Promise<AuthorMetadata | null> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const [data, errors] = compile<AuthorMetadata>(content);
    if (errors.length > 0) {
      console.warn(
        `Markit errors in ${filePath}: ${errors[0]?.message} (line ${errors[0]?.line})`
      );
    }
    if (typeof data.forename !== "string" || typeof data.surname !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function parseTextIndex(
  filePath: string
): Promise<TextMetadata | null> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    const [data, errors] = compile<TextMetadata>(content, {
      filePath,
      embedExternalChildren: false,
    });
    if (errors.length > 0) {
      console.warn(
        `Markit errors in ${filePath}: ${errors[0]?.message} (line ${errors[0]?.line})`
      );
    }
    if (typeof data.title !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
