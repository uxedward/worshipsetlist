import { prisma } from './db.ts'
import { emailProblem, hashPassword, normalizeEmail, passwordProblem } from './auth.ts'

/**
 * Optional bootstrap for deployments that would rather not use the in-app
 * first-run screen. Set ADMIN_EMAIL and ADMIN_PASSWORD and the account appears
 * on boot. It never overwrites an existing account, so leaving the variables
 * set after the first deploy is harmless.
 */
export async function seedAdminFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const email = normalizeEmail(env.ADMIN_EMAIL)
  const password = env.ADMIN_PASSWORD
  if (!email || !password) return null
  if (emailProblem(email) || passwordProblem(password)) {
    console.error('ADMIN_EMAIL / ADMIN_PASSWORD are set but not usable; skipping the admin seed.')
    return null
  }
  try {
    if (await prisma.user.findUnique({ where: { email } })) return null
    return await prisma.user.create({
      data: {
        email,
        name: env.ADMIN_NAME?.trim() || email.split('@')[0],
        role: 'admin',
        passwordHash: hashPassword(password),
      },
      select: { id: true, email: true, role: true },
    })
  } catch (err) {
    console.error('Could not seed the admin account', err)
    return null
  }
}
