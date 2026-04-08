"use client";

import Link from "next/link";

type Member = {
  userId: string;
  role: string;
  user: { name: string; image: string | null };
};

type Group = {
  id: string;
  name: string;
  trips: { id: string }[];
  members: Member[];
  role: string;
};

type Props = {
  groups: Group[];
};

function AvatarStack({ members }: { members: Member[] }) {
  const shown = members.slice(0, 4);
  const extra = members.length - shown.length;
  const colors = ["bg-[#E8622A]", "bg-[#2D6A8F]", "bg-[#3D9970]", "bg-[#A78BFA]", "bg-[#F2A93B]"];

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div
          key={m.userId}
          className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white ${colors[i % colors.length]} ${i > 0 ? "-ml-2" : ""}`}
        >
          {m.user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="-ml-2 w-7 h-7 rounded-full border-2 border-white bg-[#F0EDE8] flex items-center justify-center text-[9px] font-bold text-[#6B6560]">
          +{extra}
        </div>
      )}
    </div>
  );
}

export function GroupsClient({ groups }: Props) {
  return (
    <div className="px-5 pt-14 pb-6">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-[26px] font-bold text-[#1A1512] tracking-tight">Groups</h1>
        <Link
          href="/groups/new"
          className="px-4 py-2 bg-[#E8622A] text-white text-sm font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
        >
          + New
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">👥</span>
          <p className="text-[17px] font-semibold text-[#1A1512]">No groups yet</p>
          <p className="text-sm text-[#6B6560] mt-1 mb-6">Create a group to start planning trips together</p>
          <Link
            href="/groups/new"
            className="px-6 py-3 bg-[#E8622A] text-white font-bold rounded-[12px] shadow-[0_2px_8px_rgba(232,98,42,0.30)]"
          >
            Create a group
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/groups/${group.id}`}>
              <div className="bg-white border border-[#E5E0DA] rounded-[16px] p-4 shadow-[0_1px_3px_rgba(26,21,18,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1A1512] truncate">{group.name}</p>
                    <p className="text-xs text-[#A09B96] mt-0.5">
                      {group.trips.length} trip{group.trips.length !== 1 ? "s" : ""} · {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <AvatarStack members={group.members} />
                </div>
                {group.role === "owner" && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(232,98,42,0.12)] text-[#E8622A]">
                    Owner
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
