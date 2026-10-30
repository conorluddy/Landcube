import { defineSpecimens } from './specimens';
import { StatusMessage } from './status-message';

export default defineSpecimens('status-message', [
  {
    variant: 'ok',
    width: 320,
    render: () => <StatusMessage kind="ok">Real terrain loaded</StatusMessage>,
  },
  {
    variant: 'info',
    width: 320,
    render: () => <StatusMessage kind="info">Downloading roads…</StatusMessage>,
  },
  {
    variant: 'fault',
    state: 'alert',
    width: 320,
    render: () => (
      <StatusMessage kind="fault" code="E-204" isAlert>
        Terrain tile download failed. Check the connection, then load again.
      </StatusMessage>
    ),
  },
  {
    variant: 'fault',
    state: 'withoutCode',
    width: 320,
    render: () => (
      <StatusMessage kind="fault" isAlert>
        Increase Overhang or reduce Edge size.
      </StatusMessage>
    ),
  },
  {
    variant: 'info',
    state: 'emptyMounted',
    width: 320,
    render: () => <StatusMessage kind="info" isAlwaysMounted tabIndex={-1} />,
  },
  {
    variant: 'ok',
    state: 'long',
    width: 200,
    render: () => (
      <StatusMessage kind="ok" code="OK-200">
        Loaded a very long place name such as
        Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch
      </StatusMessage>
    ),
  },
]);
