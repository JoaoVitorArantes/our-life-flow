import { describe, expect, it } from "vitest";
import { fundingSummary, installmentState, loanTotals, monthlySchedule } from "./funding";

const loan = {
  id: "L",
  kind: "loan",
  promised_amount: null,
  received_amount: 10000,
  total_to_repay: 12000,
};
const inst = [
  { id: "i1", source_id: "L", number: 1, due_date: "2027-01-10", amount: 1000 },
  { id: "i2", source_id: "L", number: 2, due_date: "2027-02-10", amount: 1000 },
  { id: "i3", source_id: "L", number: 3, due_date: "2027-03-10", amount: 1000 },
];
const pays = [
  { id: "p1", installment_id: "i1", amount: 1000, paid_on: "2027-01-09" },
  { id: "p2", installment_id: "i2", amount: 400, paid_on: "2027-02-01" },
];
const today = "2027-02-20";

describe("parcelas do empréstimo do casamento", () => {
  it("paga, vencida parcial e a vencer", () => {
    expect(installmentState(inst[0]!, pays, today).status).toBe("paid");
    const s2 = installmentState(inst[1]!, pays, today);
    expect(s2).toMatchObject({ status: "overdue", paid: 400, remaining: 600, partial: true });
    expect(installmentState(inst[2]!, pays, today).status).toBe("upcoming");
  });
  it("saldo devedor = total a devolver − pago", () => {
    expect(loanTotals(loan, inst, pays, today)).toMatchObject({
      toRepay: 12000,
      paid: 1400,
      balance: 10600,
      overdue: 1,
    });
  });
  it("sem total informado usa a soma das parcelas; sem parcelas fica desconhecido", () => {
    expect(loanTotals({ ...loan, total_to_repay: null }, inst, pays, today).toRepay).toBe(3000);
    expect(
      loanTotals({ ...loan, id: "X", total_to_repay: null }, inst, pays, today).toRepay,
    ).toBeNull();
  });
  it("juros zero: devolver igual ao recebido", () => {
    expect(loanTotals({ ...loan, total_to_repay: 10000 }, [], [], today).balance).toBe(10000);
  });
});

describe("resumo das fontes", () => {
  it("separa próprio, empréstimo e família; compromissos só futuros em aberto", () => {
    const r = fundingSummary(
      [
        loan,
        {
          id: "O",
          kind: "own",
          promised_amount: 5000,
          received_amount: 3000,
          total_to_repay: null,
        },
        {
          id: "F",
          kind: "family",
          promised_amount: 2000,
          received_amount: null,
          total_to_repay: null,
        },
      ],
      inst,
      pays,
      today,
    );
    expect(r).toMatchObject({
      ownReserved: 5000,
      ownReceived: 3000,
      loanReceived: 10000,
      familyPromised: 2000,
      familyReceived: 0,
      toRepay: 12000,
      debtPaid: 1400,
      balance: 10600,
    });
    expect(r.monthly).toEqual([
      { month: "2027-02", amount: 600 },
      { month: "2027-03", amount: 1000 },
    ]);
  });
});

describe("cronograma mensal", () => {
  it("ajusta fim de mês e vira o ano", () => {
    expect(monthlySchedule("2027-11-31".replace("11-31", "11-30"), 3)).toEqual([
      "2027-11-30",
      "2027-12-30",
      "2028-01-30",
    ]);
    expect(monthlySchedule("2028-01-31", 2)).toEqual(["2028-01-31", "2028-02-29"]);
  });
});
