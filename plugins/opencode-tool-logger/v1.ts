import { appendV1Event } from './log.ts';

export type V1Context = {
  directory?: string;
};

type V1Callback = (input: unknown, output: unknown) => void;

export type V1Hooks = {
  'tool.execute.before': V1Callback;
  'tool.execute.after': V1Callback;
};

export default function opencodeToolLoggerV1(context: V1Context): V1Hooks {
  const directory = typeof context.directory === 'string' && context.directory
    ? context.directory : null;
  return {
    'tool.execute.before': (input, output) => {
      try { appendV1Event('tool.execute.before', input, output, directory); }
      catch { /* Telemetry must never affect tool execution. */ }
    },
    'tool.execute.after': (input, output) => {
      try { appendV1Event('tool.execute.after', input, output, directory); }
      catch { /* Telemetry must never affect tool execution. */ }
    },
  };
}
