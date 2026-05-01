'use server';

import { z } from 'zod';
import { createSession, getSession as getSessionFromCookie, removeSession } from '@/lib/auth';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const logActivity = async (description: string) => {
    try {
        const session = await getSession();
        if (!session) return; // Don't log if no session
        
        await db.insert(schema.activityLog).values({ 
            description,
            userId: session.id,
            username: session.username, 
        });
    } catch(e) {
        console.error("Failed to log activity:", e);
    }
}

export async function getSession() {
    return await getSessionFromCookie();
}

export async function hasUsers() {
    const allUsers = await db.select().from(schema.users).limit(1);
    return allUsers.length > 0;
}

const LoginInputSchema = z.object({
    username: z.string().email("Username must be a valid email address."),
    password: z.string(),
    rememberMe: z.boolean().optional(),
});

export async function login(input: z.infer<typeof LoginInputSchema>) {
    let isFirstUser = false;
    
    let [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.username)).limit(1);
    
    if (!user) {
        const usersCount = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
        if (Number(usersCount[0].count) === 0) {
            isFirstUser = true;
            const hashedPassword = await bcrypt.hash(input.password, 10);
            [user] = await db.insert(schema.users).values({
                email: input.username,
                password: hashedPassword,
                role: 'admin',
            }).returning();
        } else {
            throw new Error("Invalid login credentials");
        }
    } else {
        const passwordMatch = await bcrypt.compare(input.password, user.password);
        if (!passwordMatch) {
            throw new Error("Invalid login credentials");
        }
    }
    
    if (!user) {
        throw new Error("Login failed: could not retrieve user.");
    }
    
    const sessionPayload = {
        id: user.id,
        username: user.email,
        role: user.role as 'admin' | 'user',
        accessToken: '', // Not used in local auth
    };
    
    await createSession(sessionPayload, input.rememberMe);

    let needsData = false;
    if (!isFirstUser) {
        const cashCountResult = await db.select({ count: sql<number>`count(*)` }).from(schema.cashTransactions);
        const bankCountResult = await db.select({ count: sql<number>`count(*)` }).from(schema.bankTransactions);
        needsData = Number(cashCountResult[0].count) === 0 && Number(bankCountResult[0].count) === 0;
    }
    
    if (isFirstUser) {
        await logActivity("Created the first admin user and logged in.");
    } else {
        await logActivity("User logged in.");
    }

    return { 
        success: true, 
        needsInitialBalance: isFirstUser || needsData,
        session: sessionPayload 
    };
}

export async function logout() {
  await logActivity("User logged out.");
  await removeSession();
}

export async function getUsers() {
    const session = await getSession();
    if(session?.role !== 'admin') throw new Error("Only admins can view users.");

    const allUsers = await db.select().from(schema.users);
    return allUsers.map(u => ({ id: u.id, username: u.email, role: u.role }));
}

const AddUserInputSchema = z.object({
    username: z.string().email("Username must be a valid email address."),
    password: z.string().min(6),
    role: z.enum(['admin', 'user']),
});

export async function addUser(input: z.infer<typeof AddUserInputSchema>) {
    const session = await getSession();
    if(session?.role !== 'admin') throw new Error("Only admins can add users.");

    const hashedPassword = await bcrypt.hash(input.password, 10);
    await db.insert(schema.users).values({
        email: input.username,
        password: hashedPassword,
        role: input.role,
    });
    
    await logActivity(`Added new user: ${input.username} with role: ${input.role}`);
    return { success: true };
}

export async function deleteUser(id: string) {
    const session = await getSession();
    if(session?.role !== 'admin') throw new Error("Only admins can delete users.");

    await db.delete(schema.users).where(eq(schema.users.id, id));
    
    await logActivity(`Deleted user with ID: ${id}`);
    return { success: true };
}
