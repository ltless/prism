"use client";

import { useState, useRef, useCallback } from "react";
import { ConfirmModal } from "../components/ConfirmModal";

export interface ConfirmOptions {
	message: string;
	title?: string;
	confirmLabel?: string;
	cancelLabel?: string;
}

interface ConfirmState {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel: string;
}

const DEFAULTS: Omit<ConfirmState, "isOpen"> = {
	title: "Confirm Action",
	message: "",
	confirmLabel: "Confirm",
	cancelLabel: "Cancel",
};

export function useConfirm() {
	const [state, setState] = useState<ConfirmState>({ ...DEFAULTS, isOpen: false });
	const resolverRef = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
		const opts = typeof options === "string" ? { message: options } : options;
		setState({
			isOpen: true,
			title: opts.title || DEFAULTS.title,
			message: opts.message,
			confirmLabel: opts.confirmLabel || DEFAULTS.confirmLabel,
			cancelLabel: opts.cancelLabel || DEFAULTS.cancelLabel,
		});
		return new Promise<boolean>((resolve) => {
			resolverRef.current = resolve;
		});
	}, []);

	const handleConfirm = useCallback(() => {
		resolverRef.current?.(true);
		resolverRef.current = null;
		setState(s => ({ ...s, isOpen: false }));
	}, []);

	const handleCancel = useCallback(() => {
		resolverRef.current?.(false);
		resolverRef.current = null;
		setState(s => ({ ...s, isOpen: false }));
	}, []);

	return {
		confirm,
		ConfirmDialog: (
			<ConfirmModal
				isOpen={state.isOpen}
				title={state.title}
				message={state.message}
				confirmLabel={state.confirmLabel}
				cancelLabel={state.cancelLabel}
				onConfirm={handleConfirm}
				onCancel={handleCancel}
			/>
		),
	};
}
