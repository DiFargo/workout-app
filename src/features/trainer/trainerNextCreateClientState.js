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
  setAdminNewUserEmail,
  setAdminNewUserName,
  setAdminNewUserPassword
}) {
  return buildTrainerCreateClientState({
    open: adminCreateClientModalOpen,
    name: adminNewUserName,
    email: adminNewUserEmail,
    password: adminNewUserPassword,
    loading: adminCreateUserLoading,
    status: adminCreateUserStatus,
    credentials: adminCreatedCredentials
  }, {
    onClose: () => setAdminCreateClientModalOpen(false),
    onNameChange: setAdminNewUserName,
    onEmailChange: setAdminNewUserEmail,
    onPasswordChange: setAdminNewUserPassword,
    onGeneratePassword: generateAdminPassword,
    onSubmit: createUserFromAdminPanel
  });
}
