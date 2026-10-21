import type { Request, Response, NextFunction } from "express";
import { URLModel } from "../models/URLModel";
import { generateSlug } from "../utils/slugGenerator";

export const createUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { url } = req.body;
    if (typeof url !== "string" || url.trim() === "") {
      res.status(400).json({ err: "Enter a URL" });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      res.status(400).json({ err: "Must be a valid http(s) URL" });
      return;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      res.status(400).json({ err: "Only http and https URLs are allowed" });
      return;
    }

    const slug = generateSlug();
    await URLModel.create({ url, slug });

    res.status(201).json(`${process.env.BASE_URL}/${slug}`);
  } catch (error) {
    next(error);
  }
};
