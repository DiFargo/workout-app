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
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../../../src/data/basicWorkoutExerciseLibrary";
import { useModalFocusTrap } from "../../../src/shared/hooks/useModalFocusTrap";
import "../../../src/styles/index.css";
import "../../../src/AppCoreTheme.module.css";
import "../../../src/shared/ui/ResponsiveModalLayer.module.css";
import "../../../src/AppCoreClientAppleTheme.css";

const users = [
  {id:"client-1",name:"Анна Ковалёва",email:"anna@example.test",role:"client"},
  {id:"trainer-1",name:"Алексей Соколов",email:"alex@example.test",role:"trainer"},
  {id:"trainer-2",name:"Мария Новикова",email:"maria@example.test",role:"trainer",status:"pending"},
  {id:"trainer-3",name:"Иван Петров",email:"ivan@example.test",role:"trainer",accessDisabled:true},
  {id:"admin-1",name:"Администратор",email:"admin@example.test",role:"admin"}
];
const programs=[{id:"base",name:"Силовая база · 3 дня",description:"Начальный уровень, всё тело",workouts:[{name:"День 1",exercises:[{name:"Приседания",sets:3,reps:12}]}]}];
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
  const titles={overview:"Обзор",users:trainer?"Профиль тренера":"Пользователи и роли",programs:"Базовые программы",exercises:"Базовые упражнения"};
  return <>
    <AdminWorkspace activeSection={section} headerTitle={titles[section]} adminName="Александр" adminEmail="admin@example.test"
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
        : <AdminUsersWorkspace users={query.has("empty")?[]:users} isLoading={query.has("loading")} error={query.has("error")?"Проверьте подключение":""} onRetry={()=>setAction("retry")}
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
