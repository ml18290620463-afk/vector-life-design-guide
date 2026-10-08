declare const __VECTOR_BUILD__: {
  revision: string;
  branch: string;
  builtAt: string;
  modified: boolean;
  edition: string;
};
export const buildInfo =
  typeof __VECTOR_BUILD__ === 'undefined'
    ? { revision: 'test', branch: 'test', builtAt: '', modified: false, edition: 'test' }
    : __VECTOR_BUILD__;
