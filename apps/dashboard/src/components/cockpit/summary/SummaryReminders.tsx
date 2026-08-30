type Reminder = {
  icon: string;
  title: string;
  description: string;
};

type Props = {
  reminders: Reminder[];
};

export function SummaryReminders({ reminders }: Props) {
  if (!reminders.length) return null;

  return (
    <section className="family-section">
      <h2 className="text-base font-semibold mb-3">系统提醒</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {reminders.map((reminder, i) => (
          <div key={i}>
            <div className="cockpit-card h-full">
              <div className="cockpit-card-body flex items-start gap-3">
                <span className="icon-md text-surface-3 shrink-0">
                  <i className={`bi bi-${reminder.icon}`}></i>
                </span>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{reminder.title}</h3>
                  <p className="text-xs text-surface-2 mb-0">{reminder.description}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
