import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  getAllIssues,
  getIssueByIdOrTracking,
  checkDuplicate,
  createIssue,
  addSupportingReport,
  assignDepartment,
  updateIssueStatus,
  addInternalNote,
  submitResolutionProof,
  verifyResolution,
  getAnalytics,
  resetDemoData,
  DEPARTMENTS,
} from './server/db.js';
import { analyzeIssueWithGemini } from './server/gemini.js';
import { authenticateUser, registerUser, USERS } from './server/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Parse JSON request bodies up to 15mb for base64 image uploads
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// -------------------------------------------------------------
// AUTHENTICATION ROUTES (ROLE SEPARATION)
// -------------------------------------------------------------

// Auth Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const user = authenticateUser(email, password, role);
    if (!user) {
      res.status(401).json({
        success: false,
        error: role
          ? `Invalid credentials for ${role} portal. Ensure you are logging into the correct portal.`
          : 'Invalid email or password.',
      });
      return;
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

// Auth Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, role, phone, department, employee_id } = req.body;
    if (!name || !email || !role) {
      res.status(400).json({ success: false, error: 'Name, email, and role are required' });
      return;
    }

    const user = registerUser({
      name,
      email,
      password,
      role,
      phone,
      department,
      employee_id,
    });

    res.status(201).json({ success: true, user });
  } catch (error: any) {
    console.error('[Auth] Register error:', error);
    res.status(400).json({ success: false, error: error.message || 'Registration failed' });
  }
});

// Get Demo Accounts
app.get('/api/auth/demo-users', (_req: Request, res: Response) => {
  const citizens = USERS.filter((u) => u.role === 'citizen').map(({ passwordHash, ...u }) => ({
    ...u,
    samplePassword: passwordHash,
  }));
  const authorities = USERS.filter((u) => u.role === 'authority').map(({ passwordHash, ...u }) => ({
    ...u,
    samplePassword: passwordHash,
  }));
  res.json({ success: true, citizens, authorities });
});

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// 1. Get departments
app.get('/api/departments', (_req: Request, res: Response) => {
  res.json({ departments: DEPARTMENTS });
});

// 2. List all issues with filters
app.get('/api/issues', (req: Request, res: Response) => {
  try {
    const { category, priority, status, department, search } = req.query;
    const issues = getAllIssues({
      category: category as string,
      priority: priority as string,
      status: status as string,
      department: department as string,
      search: search as string,
    });
    res.json({ success: true, issues, count: issues.length });
  } catch (error: any) {
    console.error('[API] /api/issues error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch issues' });
  }
});

// 3. Get single issue by ID or Tracking code
app.get('/api/issues/:idOrTracking', (req: Request, res: Response) => {
  try {
    const issue = getIssueByIdOrTracking(req.params.idOrTracking);
    if (!issue) {
      res.status(404).json({ success: false, error: 'Civic issue not found' });
      return;
    }
    res.json({ success: true, issue });
  } catch (error: any) {
    console.error('[API] /api/issues/:id error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch issue' });
  }
});

// 4. Check for duplicate issues before submission
app.post('/api/issues/check-duplicate', (req: Request, res: Response) => {
  try {
    const { category, latitude, longitude, description } = req.body;
    if (!category) {
      res.status(400).json({ success: false, error: 'Category is required' });
      return;
    }

    const result = checkDuplicate(category, latitude, longitude, description);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[API] Duplicate check error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify duplicates' });
  }
});

// 5. Pre-analyze issue with Gemini AI
app.post('/api/issues/analyze-ai', async (req: Request, res: Response) => {
  try {
    const { category, description, locationHint } = req.body;
    if (!description || !description.trim()) {
      res.status(400).json({ success: false, error: 'Description is required for AI analysis' });
      return;
    }

    const analysis = await analyzeIssueWithGemini(category || 'Other', description, locationHint);
    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('[API] AI analysis error:', error);
    res.status(500).json({ success: false, error: 'AI analysis failed' });
  }
});

// 6. Create new issue
app.post('/api/issues', async (req: Request, res: Response) => {
  try {
    const {
      category,
      title,
      description,
      evidence_url,
      latitude,
      longitude,
      address,
      landmark,
      severity,
      urgency,
      department,
      contact_name,
      contact_email,
      contact_phone,
      ai_summary,
      ai_reasoning,
    } = req.body;

    if (!category || !description || latitude === undefined || longitude === undefined || !address) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: category, description, address, and coordinates are mandatory.',
      });
      return;
    }

    // If severity / urgency not provided, run AI analysis or fallback
    let finalSev = severity;
    let finalUrg = urgency;
    let finalDept = department;
    let finalSummary = ai_summary;
    let finalReasoning = ai_reasoning;

    if (!finalSev || !finalUrg || !finalDept) {
      const aiResult = await analyzeIssueWithGemini(category, description, address);
      finalSev = finalSev || aiResult.severity;
      finalUrg = finalUrg || aiResult.urgency;
      finalDept = finalDept || aiResult.suggested_department;
      finalSummary = finalSummary || aiResult.concise_summary;
      finalReasoning = finalReasoning || aiResult.reasoning;
    }

    const created = createIssue({
      category,
      title: title || `${category} on ${address.split(',')[0]}`,
      description,
      evidence_url,
      latitude: Number(latitude),
      longitude: Number(longitude),
      address,
      landmark,
      severity: finalSev || 'MEDIUM',
      urgency: finalUrg || 'MEDIUM',
      department: finalDept,
      contact_name,
      contact_email,
      contact_phone,
      ai_summary: finalSummary,
      ai_reasoning: finalReasoning,
    });

    res.status(201).json({ success: true, issue: created });
  } catch (error: any) {
    console.error('[API] Create issue error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to submit issue' });
  }
});

// 7. "I also face this" / Endorse existing issue
app.post('/api/issues/:id/me-too', (req: Request, res: Response) => {
  try {
    const { citizen_name, citizen_phone, note } = req.body;
    const updated = addSupportingReport(req.params.id, citizen_name, citizen_phone, note);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, issue: updated, message: 'Your support has been recorded! Priority recalculated.' });
  } catch (error: any) {
    console.error('[API] Me-too error:', error);
    res.status(500).json({ success: false, error: 'Failed to record endorsement' });
  }
});

// 8. Assign department (Admin action)
app.patch('/api/issues/:id/assign', (req: Request, res: Response) => {
  try {
    const { department, actor_name } = req.body;
    if (!department) {
      res.status(400).json({ success: false, error: 'Department is required' });
      return;
    }
    const updated = assignDepartment(req.params.id, department, actor_name);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, issue: updated });
  } catch (error: any) {
    console.error('[API] Assign department error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign department' });
  }
});

// 9. Update issue status (Admin action)
app.patch('/api/issues/:id/status', (req: Request, res: Response) => {
  try {
    const { status, note, actor, actor_name } = req.body;
    if (!status) {
      res.status(400).json({ success: false, error: 'Status is required' });
      return;
    }
    const updated = updateIssueStatus(req.params.id, status, note, actor, actor_name);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, issue: updated });
  } catch (error: any) {
    console.error('[API] Update status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// 10. Add internal note (Admin action)
app.post('/api/issues/:id/internal-notes', (req: Request, res: Response) => {
  try {
    const { note, author } = req.body;
    if (!note || !note.trim()) {
      res.status(400).json({ success: false, error: 'Note text is required' });
      return;
    }
    const updated = addInternalNote(req.params.id, note, author);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, issue: updated });
  } catch (error: any) {
    console.error('[API] Internal note error:', error);
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});

// 11. Submit Resolution Proof (Admin action: before image, after image, note)
app.post('/api/issues/:id/submit-resolution', (req: Request, res: Response) => {
  try {
    const { before_image, after_image, resolution_note, submitted_by } = req.body;
    if (!after_image || !resolution_note) {
      res.status(400).json({
        success: false,
        error: 'After image and resolution note are required to complete resolution proof.',
      });
      return;
    }
    const updated = submitResolutionProof(
      req.params.id,
      before_image,
      after_image,
      resolution_note,
      submitted_by
    );
    if (!updated) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({ success: true, issue: updated, message: 'Resolution submitted for citizen verification!' });
  } catch (error: any) {
    console.error('[API] Resolution submission error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit resolution proof' });
  }
});

// 12. Citizen verifies resolution: Confirm or Reopen
app.post('/api/issues/:id/verify-resolution', (req: Request, res: Response) => {
  try {
    const { confirmed, rejection_reason, citizen_name } = req.body;
    const isConfirmed = Boolean(confirmed);
    const updated = verifyResolution(req.params.id, isConfirmed, rejection_reason, citizen_name);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Issue not found' });
      return;
    }
    res.json({
      success: true,
      issue: updated,
      message: isConfirmed
        ? 'Thank you! Issue marked as Resolved & Verified.'
        : 'Issue has been reopened and escalated to the authority.',
    });
  } catch (error: any) {
    console.error('[API] Verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to record resolution verification' });
  }
});

// 13. Analytics summary & Hotspots
app.get('/api/analytics', (_req: Request, res: Response) => {
  try {
    const analytics = getAnalytics();
    res.json({ success: true, analytics });
  } catch (error: any) {
    console.error('[API] Analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate analytics' });
  }
});

// 14. Reset demo data
app.post('/api/demo/reset', (_req: Request, res: Response) => {
  try {
    const issues = resetDemoData();
    res.json({ success: true, issues, message: 'Sample demo data restored successfully.' });
  } catch (error: any) {
    console.error('[API] Reset demo error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset demo data' });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION SERVE
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TechCity] Civic Issue Management server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[TechCity] Failed to boot server:', err);
  process.exit(1);
});
