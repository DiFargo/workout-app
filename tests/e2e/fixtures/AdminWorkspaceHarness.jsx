/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UsersRound, GraduationCap, UserRound } from "lucide-react";
import AdminWorkspace from "../../../src/components/admin/AdminWorkspace";
import AdminUsersWorkspace from "../../../src/components/admin/AdminUsersWorkspace";
import AdminTrainerProfile from "../../../src/components/admin/AdminTrainerProfile";
import AdminTrainerInviteModal from "../../../src/components/admin/AdminTrainerInviteModal";
import AdminClientAssignmentModal from "../../../src/components/admin/AdminClientAssignmentModal";
import AdminBaseLibrary from "../../../src/components/admin/AdminBaseLibrary";
import AdminUsersWorkspaceRoute from "../../../src/features/trainer/AdminUsersWorkspaceRoute";
import AdminClientProfileRoute from "../../../src/features/trainer/AdminClientProfileRoute";
import AdminLibraryRoute from "../../../src/app/AdminLibraryRoute";
import { APP_PAGES } from "../../../src/app/appPages";
import AdminPanelHub from "../../../src/components/admin/AdminPanelHub";
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../../../src/data/basicWorkoutExerciseLibrary";
import { useModalFocusTrap } from "../../../src/shared/hooks/useModalFocusTrap";
import { auth } from "../../../src/firebase";
import "../../../src/styles/index.css";
import "../../../src/styles/_variables.css";
import "../../../src/AppCoreTheme.module.css";
import "../../../src/shared/ui/ResponsiveModalLayer.module.css";
import "../../../src/AppCoreClientAppleTheme.css";
import "../../../src/components/trainer/TrainerWorkspaceV2.module.css";

document.documentElement.dataset.trainerVariant = "v2";

const users = [
  {id:"client-1",name:"Анна Ковалёва",email:"anna@example.test",role:"client"},
  {id:"trainer-1",name:"Алексей Соколов",email:"alex@example.test",role:"trainer"},
  {id:"trainer-2",name:"Мария Новикова",email:"maria@example.test",role:"trainer",status:"pending"},
  {id:"trainer-3",name:"Иван Петров",email:"ivan@example.test",role:"trainer",accessDisabled:true},
  {id:"admin-1",name:"Администратор",email:"admin@example.test",role:"admin"}
];
const programs=[{id:"base",name:"Силовая база · 3 дня",description:"Начальный уровень, всё тело",workouts:[{name:"День 1",exercises:[{name:"Приседания",sets:3,reps:12}]}]}];
// Only this DEV fixture supplies a transport identity; the endpoint is mocked
// by its focused browser test and never reaches a Firebase project.
await auth.authStateReady();
auth.currentUser = {
  uid: "admin-fixture",
  getIdToken: async () => "fixture-token",
  // Firestore's Auth interop subscribes to this DEV-only transport double.
  // These no-ops prevent SDK-internal errors; no real identity is signed in.
  stsTokenManager: { accessToken: "fixture-token" },
  _startProactiveRefresh() {},
  _stopProactiveRefresh() {}
};

function AdminAccountRoutesHarness() {
  const [page, setPage] = useState(APP_PAGES.ADMIN_PANEL);
  const [libraryTab, setLibraryTab] = useState("programs");
  const [action, setAction] = useState("");
  const user = { uid: "admin-fixture", displayName: "Александр", email: "admin@example.test" };
  const logout = () => setAction("logout");
  const openProfileAccount = () => setAction("profile");
  const openAdminClientsWithFilter = () => setPage(APP_PAGES.ADMIN_USERS);
  const openAdminBaseLibrary = tab => { setLibraryTab(tab); setPage(APP_PAGES.ADMIN_LIBRARY); };
  return <>
    {page === APP_PAGES.ADMIN_PANEL ? <AdminPanelHub canUseAdminFeatures={() => true} setPage={setPage} user={user} adminAllUsersList={users}
      onLogout={logout} onProfileClick={openProfileAccount} openAdminClientsWithFilter={openAdminClientsWithFilter} openAdminBaseLibrary={openAdminBaseLibrary} /> : null}
    {page === APP_PAGES.ADMIN_USERS ? <AdminUsersWorkspaceRoute adminAllUsersList={users} canUseAdminFeatures={() => true} user={user} logout={logout}
      openProfileAccount={openProfileAccount} setPage={setPage} openAdminBaseLibrary={openAdminBaseLibrary} loadUsers={() => {}} /> : null}
    {page === APP_PAGES.ADMIN_LIBRARY ? <AdminLibraryRoute adminTrainingTemplates={[]} adminBaseLibraryTab={libraryTab} user={user} onSetPage={setPage}
      openAdminClientsWithFilter={openAdminClientsWithFilter} openAdminBaseLibrary={openAdminBaseLibrary} onAdminLogout={logout} onAdminProfileClick={openProfileAccount}
      loadAdminTrainingTemplates={() => Promise.resolve([])} /> : null}
    <output data-testid="admin-harness-action">{action}</output>
  </>;
}

function AdminClientScrollHarness() {
  const [tab, setTab] = useState("overview");
  const client = { ...users[0], firstSetupCompleted: true, assignedProgramId: "scroll-program", assignedProgramName: "План клиента", assignedWorkoutCount: 4,
    assignedProgramUpdatedAt: "2026-10-01T10:00:00Z", firstSetupCompletedVersion: 2,
    trainerSetupChecklist: { version: 2, completedSteps: { program: true, schedule: true, nutrition: true, notifications: true } },
    workoutCalendar: { scheduledDates: ["2026-10-01", "2026-10-04", "2026-10-07", "2026-10-10"] } };
  const summary = { completedWorkouts: 2, totalWorkouts: 4, nutritionDays: 6, nutritionDaysTotal: 7, weight: 75, lastActivityAt: "2026-10-10T10:00:00Z" };
  const workouts = Array.from({ length: 4 }, (_, index) => ({ id: `scroll-day-${index}`, name: `Тренировка ${index + 1}`, order: index + 1,
    assignedProgramId: "scroll-program", assignedProgramName: "План клиента", assignedProgramUpdatedAt: "2026-10-01T10:00:00Z",
    exercises: [{ id: `exercise-${index}`, name: "Жим ногами", sets: 3, reps: "10", weight: "40" }] }));
  const measurements = [10, 1].map(day => ({ id: `measurement-${day}`, date: `2026-10-${String(day).padStart(2, "0")}`, weight: 75 + day / 10, belly: 80, chest: 95,
    neck: 32, shoulders: 100, biceps: 30, forearm: 24, wrist: 16, pelvis: 98, thigh: 55, calf: 35, ankle: 20 }));
  const history = [0, 1].map(index => ({ id: `history-${index}`, workoutId: workouts[index].id, workoutName: workouts[index].name, status: "completed", completed: true,
    date: `2026-10-0${index + 1}T10:00:00Z`, assignedProgramId: "scroll-program", assignedProgramUpdatedAt: "2026-10-01T10:00:00Z", exercises: workouts[index].exercises }));
  return <AdminClientProfileRoute
    APP_VERSION="fixture" user={{ uid: "admin-fixture", displayName: "Александр", email: "admin@example.test" }}
    logout={() => {}} openProfileAccount={() => {}} setPage={() => {}} canUseAdminFeatures={() => true}
    adminAllUsersList={[client]} usersList={[client]} selectedClient={client} adminClientPageOpen adminClientTab={tab} setAdminClientTab={setTab}
    selectedProfile={{ weight: 75, height: 170, age: 30, sex: "female", goal: "recomp", trainingDays: ["mon", "wed", "fri"] }}
    selectedSummary={summary} getClientCardSummary={() => summary} getClientActivityStatus={() => "active"} getAdminClientGoalLabel={() => "Рекомпозиция"}
    telegramProfile={{ avatarUrl: "" }} selectedTrainerName="Администратор" getTrainerNextCreateClientState={() => ({ onOpen() {} })}
    plan={{ workouts }} sortWorkoutDays={items => items} trainerNextWorkspaceHandlers={{}} adminTrainingTemplates={[]} trainerExerciseLibraryItems={[]}
    adminClientMeasurements={measurements} adminClientHistory={history} adminClientEvents={[]} adminClientProgressPhotos={[{ id: "photo", date: "2026-10-10", frontUrl: "" }]}
    clientNutritionDays={Array.from({ length: 8 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, totals: { calories: 1900, protein: 110, fat: 60, carbs: 220 } }))}
    selectedEffectiveNutritionGoals={{ calories: 1900, protein: 110, fat: 60, carbs: 220 }} trainerNutritionPlanOptions={[]}
    adminClientTasks={[]} adminClientTelegramMessages={[]} adminClientStatus="" adminTrainerNote=""
    loadAdminTrainingTemplates={() => Promise.resolve([])} setAdminClientPageOpen={() => {}} setAdminSelectedClient={() => {}} setAdminClientStatus={() => {}}
    openAdminClientsWithFilter={() => {}} openAdminBaseLibrary={() => {}} navigateTrainerNext={() => {}} adminTaskComposerOpen={false}
  />;
}

function Harness() {
  useModalFocusTrap();
  const [section,setSection]=useState("overview");
  const [trainer,setTrainer]=useState(null);
  const [invite,setInvite]=useState(false);
  const [created,setCreated]=useState(null);
  const [assignment,setAssignment]=useState(null);
  const [action,setAction]=useState("");
  const navigate=id=>{setTrainer(null);setSection(id);window.scrollTo(0,0)};
  const query=new URLSearchParams(location.search);
  if (query.has("accountRoutes")) return <AdminAccountRoutesHarness />;
  if (query.has("clientScroll")) return <AdminClientScrollHarness />;
  const recoveryClients = query.has("duplicateRecovery") ? [users[0], { id: "other-client-22222222", name: users[0].name, email: "other@example.test" }] : [users[0]];
  const directoryUsers = query.has("lifecycle") ? [
    {id:"waiting",name:"Ожидает тренера",role:"client",accountAccessStatus:"awaiting_trainer"},
    {id:"suspended",name:"Приостановлен",role:"client",membershipStatus:"suspended",accountStatus:"active"},
    {id:"revoked",name:"Отозван",role:"client",membershipStatus:"revoked",accountStatus:"active"},
    {id:"archived",name:"Архивный",role:"client",archived:true},
    {id:"inactive",name:"Неактивный",role:"client",active:false}
  ] : users;
  if (query.has("hub")) return <AdminPanelHub canUseAdminFeatures={()=>true} setPage={()=>{}} adminAllUsersList={users} />;
  if (query.has("operational")) return <AdminUsersWorkspaceRoute adminAllUsersList={users} canUseAdminFeatures={()=>true}
    showAppConfirm={async value => window.confirm(`${value.title}\n${value.text}\n${value.confirmText}`)}
    setAdminAllUsersList={()=>{}} setAdminClientStatus={()=>{}} loadUsers={()=>{}} setPage={()=>{}} />;
  const titles={overview:"Обзор",users:trainer?"Профиль тренера":"Пользователи и роли",programs:"Базовые программы",exercises:"Базовые упражнения"};
  return <>
    <AdminWorkspace activeSection={section} headerTitle={titles[section]} adminName="Александр" adminEmail="admin@example.test"
      canRecoverTelegramAccess telegramRecoveryClients={recoveryClients}
      onSectionChange={navigate} onProfileClick={()=>setAction("profile")} onLogout={()=>setAction("logout")}
      overviewStats={[{id:"all",value:125,label:"Всего",icon:UsersRound},{id:"clients",value:110,label:"Клиентов",icon:UserRound},{id:"trainers",value:14,label:"Тренеров",icon:GraduationCap}]}
      overviewQueue={[{id:"clients",title:"Клиенты без тренера",description:"Назначьте тренера, чтобы начать работу",count:3},{id:"invites",title:"Ожидают активации",description:"Проверьте отправленные приглашения",count:2}]}
      onOverviewQueueAction={()=>navigate("users")} testId="admin-workspace-harness">
      {section === "overview" ? undefined : <>
      {section==="users" ? trainer ? <AdminTrainerProfile trainer={trainer} clients={[users[0]]} counts={{assignedClients:1,programs:4,libraryExercises:18}}
        onBack={()=>setTrainer(null)} onOpenClients={()=>{setTrainer(null);setAction("clients")}}
        onOpenPrograms={()=>setAction("trainer-programs")} onOpenLibrary={()=>setAction("trainer-library")}
        onChangeRole={()=>setAction("change-role")} onToggleAccess={({action:accessAction})=>setAction(accessAction)}
        onReassignClients={()=>setAction("reassign")}
        replacementTrainers={[users[2]]} onResendInvite={()=>setAction("resend")} onRevokeInvite={()=>setAction("revoke")}/>
        : <AdminUsersWorkspace users={query.has("empty")?[]:directoryUsers} isLoading={query.has("loading")} error={query.has("error")?"Проверьте подключение":""} onRetry={()=>setAction("retry")}
          onOpenTrainer={setTrainer} onOpenClient={()=>setAction("client-profile")} onOpenAdministrator={()=>setAction("admin-profile")}
          onPromoteToTrainer={()=>setAction("promote")} onAssignTrainer={setAssignment} onInviteTrainer={()=>{setCreated(null);setInvite(true)}}/> : null}
      {section==="programs"||section==="exercises" ? <AdminBaseLibrary key={section} embedded initialTab={section} exercises={BASIC_WORKOUT_EXERCISE_LIBRARY} programTemplates={programs}/> : null}
      </>}
    </AdminWorkspace>
    <AdminTrainerInviteModal open={invite} onClose={()=>setInvite(false)} createdInvite={created} onSubmit={value=>{setCreated({...value,shareUrl:"https://example.test/invite/demo"});setAction("invite")}}/>
    <AdminClientAssignmentModal open={Boolean(assignment)} client={assignment} trainers={users.filter(u=>u.role==="trainer")} onClose={()=>setAssignment(null)} onSubmit={id=>{setAction("assigned:"+id);setAssignment(null)}}/>
    <output data-testid="admin-harness-action" style={{position:"fixed",top:0,left:0,fontSize:1,pointerEvents:"none"}}>{action}</output>
  </>;
}
createRoot(document.getElementById("root")).render(<Harness/>);
