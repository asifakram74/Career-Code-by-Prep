import { Router } from 'express';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { categoriesRouter } from './categories';
import { queriesRouter } from './queries';
import { notificationsRouter } from './notifications';
import { savedAnswersRouter } from './savedAnswers';
import { articlesRouter } from './articles';
import { reviewsRouter } from './reviews';
import { uploadsRouter } from '../uploads';
import { driveRouter } from '../drive';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));

apiRouter.use(authRouter);
apiRouter.use(usersRouter);
apiRouter.use(categoriesRouter);
apiRouter.use(queriesRouter);
apiRouter.use(notificationsRouter);
apiRouter.use(savedAnswersRouter);
apiRouter.use(articlesRouter);
apiRouter.use(reviewsRouter);
apiRouter.use(uploadsRouter);
apiRouter.use(driveRouter);
