declare global {
    namespace Express {
      interface User {
        id: string;
        displayName: string;
        email: string;
        image: string;
      }
    }
  }
  
  export {};