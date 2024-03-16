import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import idl from "./idl/token_faucet.json";
import { createHash } from "crypto";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export async function build_initialize_token_tx(
    payer: PublicKey,
    token_symbol: string,
    token_decimals: number,
    token_name: string,
    token_uri: string,
    token_limit: BN,
    refresh_interval: BN,
    program_id: PublicKey,
    provider: AnchorProvider
) {
    const a = JSON.stringify(idl)
    const token_faucet_idl = JSON.parse(a)
    const program = new Program(token_faucet_idl, program_id, provider)

    const [mintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), Buffer.from(token_symbol)],
        program_id
    );

    const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mintPDA.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
    );

    const [tokenLimiterPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("limit"),
            Buffer.from(token_symbol)
        ],
        program_id
    );

    const instructions: TransactionInstruction[] = [
        await program.methods.tokenInitialize(
            token_symbol,
            token_decimals,
            token_name,
            token_uri,
            token_limit,
            refresh_interval,
        ).accounts({
            admin: payer,
            mintAccount: mintPDA,
            metadataAccount: metadataAddress,
            tokenLimiter: tokenLimiterPDA,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        }).instruction(),
    ];

    return instructions;
}

export async function build_mint_token_tx(
    user: PublicKey,
    token_symbol: String,
    amount: BN,
    program_id: PublicKey,
    provider: AnchorProvider
) {
    const a = JSON.stringify(idl)
    const token_faucet_idl = JSON.parse(a)
    const program = new Program(token_faucet_idl, program_id, provider)

    const [mintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), Buffer.from(token_symbol)],
        program_id
    );

    let hexString = createHash('sha256').update(Buffer.concat([user.toBuffer(), mintPDA.toBuffer()])).digest('hex');
    let seed = Uint8Array.from(Buffer.from(hexString, 'hex'));
    const [mintRecordPDA] = PublicKey.findProgramAddressSync(
        [seed],
        program_id
    );

    const [tokenLimiterPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("limit"),
            Buffer.from(token_symbol)
        ],
        program_id
    );

    const target_token_ATA = getAssociatedTokenAddressSync(
        mintPDA,
        user
    );

    const accountInfo = await provider.connection.getAccountInfo(mintRecordPDA);
    const instructions: TransactionInstruction[] = [];

    if (accountInfo == null) {
        const initialize_mint_record = await program.methods.userInitialize()
            .accounts({
                user: user,
                mintRecord: mintRecordPDA,
                mintAccount: mintPDA,
            }).instruction();
        instructions.push(initialize_mint_record);
    }


    const token_mint = await program.methods.tokenMint(token_symbol, amount)
        .accounts({
            user: user,
            mintAccount: mintPDA,
            tokenLimiter: tokenLimiterPDA,
            mintRecord: mintRecordPDA,
            associatedTokenAccount: target_token_ATA
        }).instruction();

    instructions.push(token_mint);

    return instructions
}

export async function build_edit_config_tx(
    token_symbol: string,
    authority: PublicKey,
    new_authority: PublicKey,
    new_max_amount: number,
    new_refresh_interval: number,
    program_id: PublicKey,
    provider: AnchorProvider,
) {
    const a = JSON.stringify(idl)
    const token_faucet_idl = JSON.parse(a)
    const program = new Program(token_faucet_idl, program_id, provider)

    const [tokenLimiterPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("limit"),
            Buffer.from(token_symbol)
        ],
        program.programId
    );

    const instructions = await program.methods.editConfig("mockSOL", new_authority, new_max_amount, new_refresh_interval)
        .accounts({
            admin: authority,
            tokenLimiter: tokenLimiterPDA,
        }).instruction();

    return instructions;
}
