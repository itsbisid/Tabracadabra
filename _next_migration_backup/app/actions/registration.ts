"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function generateRegistrationLink(
  tournamentId: string,
  roles: string[],
  autoAccept: boolean
) {
  try {
    const newLink = await prisma.registrationLink.create({
      data: {
        tournamentId,
        roles,
        autoAccept,
      },
    });
    
    revalidatePath(`/tournament/${tournamentId}/registration-links`);
    return { success: true, link: newLink };
  } catch (error) {
    console.error("Failed to generate registration link:", error);
    return { success: false, error: "Database error" };
  }
}

export async function getActiveLinks(tournamentId: string) {
  try {
    const links = await prisma.registrationLink.findMany({
      where: { tournamentId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, links };
  } catch (error) {
    console.error("Failed to fetch active links:", error);
    return { success: false, error: "Database error" };
  }
}

export async function deleteRegistrationLink(linkId: string, tournamentId: string) {
  try {
    await prisma.registrationLink.delete({
      where: { id: linkId },
    });
    revalidatePath(`/tournament/${tournamentId}/registration-links`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete link:", error);
    return { success: false, error: "Database error" };
  }
}
