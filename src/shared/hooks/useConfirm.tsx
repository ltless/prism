"use client";

import { useState, useRef, useCallback } from "react";
import { ConfirmModal } from "../components/ConfirmModal";

export interface ConfirmOptions {
	message: string;
	title?: string;
	confirmLabel?: string;
	cancelLabel?: string;
}

export function useConfirm() {
	const [isOpen, setIsOpen] = useState(false);
	const [title, setTitle] = useState("Confirm Action");
	const [message, setMessage] = useState("");
	const [confirmLabel, setConfirmLabel] = useState("Confirm");
	const [cancelLabel, setCancelLabel] = useState("Cancel");
	
	const resolverRef = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
		if (typeof options === "string") {
			setMessage(options);
			setTitle("Confirm Action");
			setConfirmLabel("Confirm");
			setCancelLabel("Cancel");
		} else {
			setMessage(options.message);
			setTitle(options.title || "Confirm Action");
			setConfirmLabel(options.confirmLabel || "Confirm");
			setCancelLabel(options.cancelLabel || "Cancel");
		}

		setIsOpen(true);
		return new Promise<boolean>((resolve) => {
			resolverRef.current = resolve;
		});
	}, []);

	const handleConfirm = useCallback(() => {
		if (resolverRef.current) {
			resolverRef.current(true);
			resolverRef.current = null;
		}
		setIsOpen(false);
	}, []);

	const handleCancel = useCallback(() => {
		if (resolverRef.current) {
			resolverRef.current(false);
			resolverRef.current = null;
		}
		setIsOpen(false);
	}, []);

	return {
		confirm,
		ConfirmDialog: isOpen ? (
			<ConfirmModal
				isOpen={isOpen}
				title={title}
				message={message}
				confirmLabel={confirmLabel}
				cancelLabel={cancelLabel}
				onConfirm={handleConfirm}
				onCancel={handleCancel}
			/>
		) : null,
	};
}
