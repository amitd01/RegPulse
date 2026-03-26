"use client";

import { useCallback } from "react";
import toast from "react-hot-toast";
import { Spinner } from "@/components/ui/Spinner";
import { useCreateOrder, usePlans } from "@/hooks/useSubscriptions";
import { useAuthStore } from "@/stores/authStore";

export default function UpgradePage() {
  const { data: plansData, isLoading } = usePlans();
  const createOrder = useCreateOrder();
  const user = useAuthStore((s) => s.user);

  const handleUpgrade = useCallback(
    async (planId: string) => {
      try {
        const order = await createOrder.mutateAsync(planId);

        // In a real app, this would open Razorpay checkout
        // For now, show the order info
        toast.success(
          `Order created: ${order.order_id}. Razorpay checkout would open here.`,
        );
      } catch {
        toast.error("Failed to create order. Please try again.");
      }
    },
    [createOrder],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const plans = plansData?.data || [];

  return (
    <div className="px-6 py-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h1>
        <p className="mt-2 text-sm text-gray-500">
          Get more credits to ask regulatory compliance questions.
        </p>
        {user && (
          <p className="mt-1 text-sm text-navy-600">
            Current balance: {user.credit_balance} credits ({user.plan} plan)
          </p>
        )}
      </div>

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
            <div className="mt-2">
              <span className="text-3xl font-bold text-navy-700">
                {plan.amount_display}
              </span>
              <span className="text-sm text-gray-500">
                /{plan.duration_days === 30 ? "month" : "year"}
              </span>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-900">
                {plan.credits.toLocaleString()} credits
              </p>
              <p className="mt-1">Cited answers from RBI circulars</p>
              <p>SSE streaming responses</p>
              <p>Full question history</p>
            </div>
            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={createOrder.isPending}
              className="mt-6 w-full rounded-lg bg-navy-700 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {createOrder.isPending ? (
                <Spinner size="sm" className="mx-auto text-white" />
              ) : (
                `Upgrade to ${plan.id === "annual" ? "Annual" : "Monthly"}`
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Free tier info */}
      <div className="mx-auto mt-8 max-w-xl text-center text-sm text-gray-500">
        <p>
          Free plan includes 5 lifetime credits. Upgrade for unlimited access
          with monthly credit refills.
        </p>
      </div>
    </div>
  );
}
