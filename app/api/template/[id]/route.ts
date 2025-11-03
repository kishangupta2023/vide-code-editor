import {
  readTemplateStructureFromJson,
  saveTemplateStructureToJson,
} from "@/modules/playground/lib/path-to-json";
import { db } from "@/lib/db";
import { templatePaths } from "@/lib/template";
import path from "path";
import fs from "fs/promises";
import { NextRequest } from "next/server";

function validateJsonStructure(data: unknown): boolean {
  try {
    JSON.parse(JSON.stringify(data)); // Ensures it's serializable
    return true;
  } catch (error) {
    console.error("Invalid JSON structure:", error);
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

const {id} = await params;

if(!id){
      return Response.json({ error: "Missing playground ID" }, { status: 400 });
}

const playground = await db.playground.findUnique({
    where:{id}
})

if (!playground) {
    return Response.json({ error: "Playground not found" }, { status: 404 });
}
  
  const templateKey = playground.template as keyof typeof templatePaths;
  const templatePath = templatePaths[templateKey]

  if (!templatePath) {
    return Response.json({ error: "Invalid template" }, { status: 404 });
  }

  try {
  const localPath = path.join(process.cwd(), templatePath);
  const vercelServerPath = path.join(process.cwd(), ".next", "server", templatePath);
  const vercelRootPath = path.join("/var/task/.next/server", templatePath); // sometimes needed in Vercel

  let inputPath: string | null = null;

  // Try local first
  try {
    await fs.access(localPath);
    inputPath = localPath;
  } catch {
    // Try .next/server in cwd
    try {
      await fs.access(vercelServerPath);
      inputPath = vercelServerPath;
    } catch {
      // Try absolute Vercel server path
      try {
        await fs.access(vercelRootPath);
        inputPath = vercelRootPath;
      } catch {
        console.error("❌ Template file not found in any location:", {
          localPath,
          vercelServerPath,
          vercelRootPath,
        });
        return Response.json({ error: "Template not found on server" }, { status: 500 });
      }
    }
  }

  console.log("✅ Using template path:", inputPath);

  const outputFile = path.join(process.cwd(), `output/${templateKey}.json`);

  await saveTemplateStructureToJson(inputPath, outputFile);
  const result = await readTemplateStructureFromJson(outputFile);

  if (!validateJsonStructure(result.items)) {
    return Response.json({ error: "Invalid JSON structure" }, { status: 500 });
  }

  await fs.unlink(outputFile);

  return Response.json({ success: true, templateJson: result }, { status: 200 });
} catch (error) {
  console.error("💥 Error generating template JSON:", error);
  return Response.json({ error: "Failed to generate template" }, { status: 500 });
}



}
