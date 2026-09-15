export type LoginInput = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type LoginResponse = {
  email: string;
};

export type LogoutResponse = {
  success: true;
};
