import { createServer } from '../server';

let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = createServer().then(result => result.app);
  }
  const app = await appPromise;
  return app(req, res);
}
