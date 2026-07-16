import { UserPlus } from "lucide-react";
import Modal from "../../shared/ui/Modal";
import styles from "./TrainerCreateClientModal.module.css";

export default function TrainerCreateClientModal({ state }) {
  return (
    <Modal
      open={Boolean(state?.open)}
      onClose={state?.onClose}
      ariaLabelledBy="trainer-create-client-title"
      portal={false}
      classNames={{ overlay: styles.overlay, backdrop: styles.backdrop, content: styles.modal }}
    >
      <button className={styles.close} type="button" onClick={state?.onClose} aria-label="Закрыть">×</button>
      <div className={styles.icon}><UserPlus size={24} /></div>
      <h2 id="trainer-create-client-title">Пригласить клиента</h2>
      <p>Клиент сам задаст пароль по ссылке активации и сможет войти по email, логину или Google.</p>
      <form onSubmit={state?.onSubmit}>
        <label><span>Имя</span><input value={state?.name || ""} onChange={(event) => state?.onNameChange(event.target.value)} placeholder="Имя клиента" /></label>
        <label><span>Email</span><input type="email" value={state?.email || ""} onChange={(event) => state?.onEmailChange(event.target.value)} placeholder="client@email.com" /></label>
        {state?.status ? <p className={styles.status}>{state.status}</p> : null}
        {state?.credentials ? (
          <div className={styles.credentials}>
            <strong>Приглашение клиента</strong>
            <code>
              {state.credentials.email}
              {state.credentials.activationUrl ? <><br />{state.credentials.activationUrl}</> : state.credentials.inviteUrl ? <><br />{state.credentials.inviteUrl}</> : null}
            </code>
          </div>
        ) : null}
        <button className={styles.submit} type="submit" disabled={state?.loading}>
          {state?.loading ? "Создаю..." : "Создать приглашение"}
        </button>
      </form>
    </Modal>
  );
}
