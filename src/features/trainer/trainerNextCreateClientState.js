import { buildTrainerCreateClientState } from "../../utils/trainerCreateClientState";

export function getTrainerNextCreateClientStateWithDeps({
  adminCreateClientModalOpen,
  adminNewUserName,
  adminNewUserEmail,
  adminNewUserPassword,
  adminCreateUserLoading,
  adminCreateUserStatus,
  adminCreatedCredentials,
  createUserFromAdminPanel,
  generateAdminPassword,
  setAdminCreateClientModalOpen,
  setAdminCreateUserStatus,
  setAdminCreatedCredentials,
  setAdminNewUserEmail,
  setAdminNewUserName,
  setAdminNewUserPassword
}) {
  return buildTrainerCreateClientState({
    open: adminCreateClientModalOpen,
    name: adminNewUserName,
    login: adminNewUserEmail,
    password: adminNewUserPassword,
    loading: adminCreateUserLoading,
    status: adminCreateUserStatus,
    credentials: adminCreatedCredentials
  }, {
    onClose: () => {
      setAdminCreateClientModalOpen(false);
      setAdminNewUserName("");
      setAdminNewUserEmail("");
      setAdminNewUserPassword("");
      setAdminCreateUserStatus("");
      setAdminCreatedCredentials(null);
    },
    onOpen: () => {
      setAdminNewUserName("");
      setAdminNewUserEmail("");
      setAdminNewUserPassword("");
      setAdminCreateUserStatus("");
      setAdminCreatedCredentials(null);
      setAdminCreateClientModalOpen(true);
    },
    onNameChange: setAdminNewUserName,
    onLoginChange: setAdminNewUserEmail,
    onPasswordChange: setAdminNewUserPassword,
    onGeneratePassword: generateAdminPassword,
    onSubmit: createUserFromAdminPanel
  });
}
