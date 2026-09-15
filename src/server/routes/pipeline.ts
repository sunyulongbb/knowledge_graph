import { adminDb, db, getProjectByIdentifier } from '../db.ts';
import { getCurrentUser } from '../auth-context.ts';
import { createPipelineHandler } from '../pipeline/http.ts';

export const handlePipelineRoutes = createPipelineHandler(adminDb, db, getCurrentUser, getProjectByIdentifier);
